from contextlib import asynccontextmanager
import logging
import warnings
from typing import List
from uuid import uuid4

warnings.filterwarnings(
    "ignore",
    message="Api key is used with an insecure connection",
)

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from nest_log import setup_logging

from .config import settings
from .connection_check import run_startup_checks
from .intent_classifier import IntentClassifier
from .llm_client import LLMClient
from .prompt_builder import PromptBuilder
from .retriever import Retriever
from .schemas import (
    HealthResponse,
    IntentDetectionRequest,
    IntentDetectionResponse,
    QueryRequest,
    QueryResponse,
    RagIntent,
    RetrievedChunk,
)

logger = setup_logging("ENGINE")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_startup_checks()
    yield


app = FastAPI(
    title="BIORING RAG Engine",
    description="Intent-aware RAG engine for ring recommendation, gemstone advice, packages and policy QA.",
    version="2.0.0",
    lifespan=lifespan,
)

intent_classifier = IntentClassifier()
retriever = Retriever()
llm_client = LLMClient()
prompt_builder = PromptBuilder()


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    logger.warning("HTTP %s: %s", exc.status_code, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc),
            "path": request.url.path,
        },
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="rag-engine",
        qdrantCollection=settings.QDRANT_COLLECTION,
        llmModel=settings.LLM_MODEL,
        embeddingModel=settings.EMBEDDING_MODEL,
    )


@app.post("/intent/detect", response_model=IntentDetectionResponse)
def detect_intent(request: IntentDetectionRequest) -> IntentDetectionResponse:
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    try:
        return intent_classifier.detect(request)
    except Exception as exc:
        logger.exception("intent/detect failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"intent detect failed: {exc}") from exc


@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest) -> QueryResponse:
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question is required")

    try:
        return _run_query(request)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("query failed requestId=%s: %s", request.requestId, exc)
        raise HTTPException(status_code=502, detail=f"query failed: {exc}") from exc


def _run_query(request: QueryRequest) -> QueryResponse:
    request_id = request.requestId or str(uuid4())
    intent_result = _resolve_intent(request)

    # If the user asks for a ring recommendation but gives almost no constraints,
    # ask a clarification question. NestJS can still call /intent/detect first and decide this itself.
    if intent_result.shouldAskClarifyingQuestion and not request.productCandidates:
        return QueryResponse(
            requestId=request_id,
            type="clarification",
            intent=RagIntent.CLARIFICATION,
            answer=intent_result.clarificationQuestion
            or "Bạn có thể cho mình biết ngân sách, dịp sử dụng và phong cách bạn thích không?",
            missingFields=intent_result.missingFields,
            productFilters=intent_result.productFilters,
            shouldAskClarifyingQuestion=True,
        )

    standalone_question = llm_client.rewrite_question(
        question=request.question,
        chat_history=request.chatHistory,
    )

    chunks = _retrieve_context(
        request=request,
        standalone_question=standalone_question,
        retrieval_types=intent_result.retrievalTypes,
    )
    context = Retriever.build_context(chunks, max_chars=settings.MAX_CONTEXT_CHARS)

    system_prompt, user_prompt = prompt_builder.build(
        request=request,
        intent_result=intent_result,
        context=context,
    )
    answer = llm_client.invoke_text(system_prompt, user_prompt)

    return QueryResponse(
        requestId=request_id,
        type=_response_type_for_intent(intent_result.intent),
        intent=intent_result.intent,
        answer=answer,
        sources=[chunk.source for chunk in chunks],
        suggestedProducts=request.productCandidates[: settings.MAX_PRODUCT_CANDIDATES],
        suggestedPackages=request.packageCandidates[: settings.MAX_PACKAGE_CANDIDATES],
        missingFields=intent_result.missingFields,
        productFilters=intent_result.productFilters,
        shouldAskClarifyingQuestion=False,
        usage={
            "standaloneQuestion": standalone_question,
            "retrievedChunks": len(chunks),
            "retrievalTypes": intent_result.retrievalTypes,
        },
    )


def _resolve_intent(request: QueryRequest) -> IntentDetectionResponse:
    if request.intentOverride:
        detection = IntentDetectionResponse(
            intent=request.intentOverride,
            confidence=1.0,
            extractedRequirements=request.extractedRequirements or intent_classifier.detect(
                IntentDetectionRequest(
                    question=request.question,
                    chatHistory=request.chatHistory,
                    language=request.options.language,
                )
            ).extractedRequirements,
            missingFields=request.missingFields,
            retrievalTypes=request.retrievalTypes,
            productFilters=request.productFilters,
            shouldAskClarifyingQuestion=False,
        )
        if not detection.retrievalTypes:
            fallback = intent_classifier.detect(
                IntentDetectionRequest(
                    question=request.question,
                    chatHistory=request.chatHistory,
                    language=request.options.language,
                )
            )
            detection.retrievalTypes = fallback.retrievalTypes
            if not detection.productFilters:
                detection.productFilters = fallback.productFilters
            if not detection.missingFields:
                detection.missingFields = fallback.missingFields
        return detection

    return intent_classifier.detect(
        IntentDetectionRequest(
            question=request.question,
            chatHistory=request.chatHistory,
            language=request.options.language,
        )
    )


def _retrieve_context(
    request: QueryRequest,
    standalone_question: str,
    retrieval_types: List[str],
) -> List[RetrievedChunk]:
    try:
        return retriever.search(
            query=standalone_question,
            workspace_id=request.workspaceId,
            document_ids=request.documentIds,
            document_types=retrieval_types,
            top_k=request.options.topK,
            score_threshold=request.options.scoreThreshold,
        )
    except Exception as exc:
        logger.error("retrieval failed: %s", exc, exc_info=True)
        # Do not hide retrieval errors in policy/package QA because those answers need context.
        if request.intentOverride in [RagIntent.POLICY_QA, RagIntent.PACKAGE_QA]:
            raise HTTPException(status_code=500, detail=f"retrieval failed: {exc}") from exc
        return []


def _response_type_for_intent(intent: RagIntent) -> str:
    if intent == RagIntent.RING_RECOMMENDATION:
        return "ring_recommendation"
    if intent == RagIntent.GEMSTONE_ADVICE:
        return "gemstone_advice"
    if intent == RagIntent.PACKAGE_QA:
        return "package_answer"
    if intent == RagIntent.POLICY_QA:
        return "policy_answer"
    if intent == RagIntent.CUSTOM_DESIGN_CONSULTING:
        return "custom_design_consulting"
    return "rag_answer"
