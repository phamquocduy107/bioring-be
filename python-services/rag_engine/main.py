from contextlib import asynccontextmanager
import logging
import warnings
from typing import Annotated, List
from uuid import uuid4

warnings.filterwarnings(
    "ignore",
    message="Api key is used with an insecure connection",
)

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from shared.nest_log import setup_logging

from .cache import answer_cache, retrieval_cache, stable_hash
from .config import settings
from .connection_check import run_startup_checks
from .intent_classifier import IntentClassifier
from .llm_client import LLMClient
from .prompt_builder import PromptBuilder
from .query_builder import (
    build_retrieval_query,
    normalize_question,
    should_rewrite_question,
)
from .retriever import Retriever
from .schemas import (
    HealthResponse,
    IntentDetectionRequest,
    IntentDetectionResponse,
    ProductCandidate,
    PackageCandidate,
    QueryDebug,
    QueryRequest,
    QueryResponse,
    RagIntent,
    RetrievedChunk,
)

logger = setup_logging("ENGINE")

TEMPLATE_NO_POLICY = (
    "Mình chưa tìm thấy thông tin này trong tài liệu chính sách hiện có của cửa hàng. "
    "Bạn vui lòng liên hệ nhân viên tư vấn để được xác nhận chính xác hơn."
)
TEMPLATE_NO_PACKAGE = (
    "Hiện mình chưa có dữ liệu gói dịch vụ phù hợp trong hệ thống. "
    "Bạn có thể hỏi về quy trình thiết kế riêng hoặc liên hệ cửa hàng để được tư vấn chi tiết."
)
TEMPLATE_NO_PRODUCTS = (
    "Hiện mình chưa tìm thấy mẫu nhẫn khớp hoàn toàn với yêu cầu này. "
    "Bạn có muốn mình mở rộng ngân sách, đổi màu đá hoặc gợi ý phong cách gần tương tự không?"
)
TEMPLATE_NO_KNOWLEDGE = (
    "Hiện cửa hàng chưa có tài liệu kiến thức phù hợp để trả lời câu hỏi này. "
    "Bạn thử hỏi theo hướng khác, hoặc liên hệ nhân viên tư vấn để được hỗ trợ trực tiếp nhé."
)
TEMPLATE_RING_PRODUCTS_NO_DOCS = (
    "Hiện mình chưa có tài liệu hướng dẫn chọn nhẫn trong hệ thống, "
    "nhưng đây là một số mẫu trong catalog có thể phù hợp yêu cầu của bạn. "
    "Bạn xem thử hoặc cho mình biết muốn điều chỉnh ngân sách / phong cách nhé."
)
TEMPLATE_CUSTOM_NO_DOCS = (
    "Hiện mình chưa có tài liệu quy trình thiết kế / biometric trong hệ thống. "
    "Bạn vui lòng liên hệ cửa hàng để được hướng dẫn chi tiết về nhẫn vân tay, giọng nói hoặc thiết kế riêng."
)
TEMPLATE_GEMSTONE_NO_DOCS = (
    "Hiện mình chưa có tài liệu tư vấn đá trong hệ thống. "
    "Bạn có thể hỏi về mẫu nhẫn theo ngân sách, hoặc liên hệ nhân viên để được tư vấn đá phù hợp."
)
TEMPLATE_PACKAGE_NO_DOCS = (
    "Hiện mình chưa tìm thấy tài liệu mô tả gói dịch vụ phù hợp. "
    "Bạn liên hệ cửa hàng để được tư vấn quyền lợi và quy trình từng gói nhé."
)

INTENT_DETECT_EXAMPLES = {
    "clarification_no_llm": {
        "summary": "Clarification: tư vấn nhẫn còn thiếu thông tin",
        "description": "Rules-first intent, llmUsed=false, shouldAskClarifyingQuestion=true.",
        "value": {
            "question": "Tư vấn cho tôi một mẫu nhẫn",
            "chatHistory": [],
            "userPreferences": {},
            "lastIntent": None,
            "language": "vi",
        },
    },
    "ring_enough_info": {
        "summary": "Ring: đủ thông tin cơ bản",
        "description": "Extract purpose, budgetMax, style, stoneColor bằng rule.",
        "value": {
            "question": "Tôi muốn nhẫn cầu hôn dưới 10 triệu, đá xanh, kiểu tối giản",
            "chatHistory": [],
            "userPreferences": {},
            "lastIntent": None,
            "language": "vi",
        },
    },
    "policy": {
        "summary": "Policy: bảo hành",
        "description": "Detect POLICY_QA bằng keyword, không gọi LLM intent.",
        "value": {
            "question": "Shop có bảo hành không?",
            "chatHistory": [],
            "userPreferences": {},
            "lastIntent": None,
            "language": "vi",
        },
    },
    "follow_up_with_preferences": {
        "summary": "Follow-up: quay lại tư vấn nhẫn",
        "description": "Dùng lastIntent + userPreferences để không cần rewrite bằng LLM.",
        "value": {
            "question": "Vậy mẫu nào hợp nhất?",
            "chatHistory": [
                {
                    "role": "user",
                    "content": "Tôi muốn nhẫn cầu hôn dưới 10 triệu, đá xanh",
                },
                {
                    "role": "assistant",
                    "content": "Mình sẽ ưu tiên nhẫn cầu hôn đá xanh trong ngân sách này.",
                },
            ],
            "userPreferences": {
                "purpose": "engagement",
                "budgetMax": 10000000,
                "stoneColor": "blue",
            },
            "lastIntent": "RING_RECOMMENDATION",
            "language": "vi",
        },
    },
}

QUERY_EXAMPLES = {
    "policy_query": {
        "summary": "Query policy: bảo hành",
        "description": "Dùng topK/threshold của POLICY_QA; hỏi lại lần 2 sẽ cache nếu bật.",
        "value": {
            "workspaceId": "bioring-catalog",
            "userId": "demo-user",
            "documentIds": [],
            "question": "Shop có bảo hành không?",
            "chatHistory": [],
            "userPreferences": {},
            "lastIntent": None,
            "intentOverride": "POLICY_QA",
            "extractedRequirements": {},
            "retrievalTypes": ["policy"],
            "productFilters": {},
            "missingFields": [],
            "productCandidates": [],
            "packageCandidates": [],
            "options": {
                "topK": 3,
                "scoreThreshold": 0.55,
                "language": "vi",
            },
        },
    },
    "ring_query_with_candidates": {
        "summary": "Query ring: đủ slot + product candidates",
        "description": "Final answer dùng LLM 1 lần, không rewrite.",
        "value": {
            "workspaceId": "bioring-catalog",
            "userId": "demo-user",
            "documentIds": [],
            "question": "Tôi muốn nhẫn cầu hôn dưới 10 triệu, đá xanh, kiểu tối giản",
            "chatHistory": [],
            "userPreferences": {
                "purpose": "engagement",
                "budgetMax": 10000000,
                "stoneColor": "blue",
                "style": "minimal",
            },
            "lastIntent": None,
            "intentOverride": "RING_RECOMMENDATION",
            "extractedRequirements": {
                "purpose": "engagement",
                "budgetMax": 10000000,
                "stoneColor": "blue",
                "style": "minimal",
            },
            "retrievalTypes": ["ring_guide", "gemstone_guide"],
            "productFilters": {
                "purpose": "engagement",
                "budgetMax": 10000000,
                "stoneColor": "blue",
                "style": "minimal",
            },
            "missingFields": [],
            "productCandidates": [
                {
                    "id": "demo-ring-01",
                    "name": "Azure Minimal Ring",
                    "price": 9500000,
                    "material": "white_gold",
                    "style": "minimal",
                    "purpose": "engagement",
                    "stoneName": "sapphire",
                    "stoneColor": "blue",
                    "imageUrl": "https://example.com/ring.jpg",
                    "tags": ["engagement", "minimal", "blue"],
                    "shortDescription": "Nhẫn cầu hôn phong cách tối giản với đá sapphire xanh.",
                }
            ],
            "packageCandidates": [],
            "options": {
                "topK": 4,
                "scoreThreshold": 0.45,
                "language": "vi",
            },
        },
    },
    "follow_up_ring": {
        "summary": "Query follow-up: không rewrite nếu có preferences",
        "description": "retrievalQuery được build từ question + preferences.",
        "value": {
            "workspaceId": "bioring-catalog",
            "userId": "demo-user",
            "documentIds": [],
            "question": "Vậy mẫu nào hợp nhất?",
            "chatHistory": [
                {
                    "role": "user",
                    "content": "Tôi muốn nhẫn cầu hôn dưới 10 triệu, đá xanh",
                },
                {
                    "role": "assistant",
                    "content": "Mình sẽ ưu tiên nhẫn cầu hôn đá xanh trong ngân sách này.",
                },
            ],
            "userPreferences": {
                "purpose": "engagement",
                "budgetMax": 10000000,
                "stoneColor": "blue",
            },
            "lastIntent": "RING_RECOMMENDATION",
            "intentOverride": "RING_RECOMMENDATION",
            "extractedRequirements": {
                "purpose": "engagement",
                "budgetMax": 10000000,
                "stoneColor": "blue",
            },
            "retrievalTypes": ["ring_guide", "gemstone_guide"],
            "productFilters": {
                "purpose": "engagement",
                "budgetMax": 10000000,
                "stoneColor": "blue",
            },
            "missingFields": ["style"],
            "productCandidates": [],
            "packageCandidates": [],
            "options": {
                "topK": 4,
                "scoreThreshold": 0.45,
                "language": "vi",
            },
        },
    },
}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_startup_checks()
    yield


app = FastAPI(
    title="BIORING RAG Engine",
    description="Intent-aware RAG engine for ring recommendation, gemstone advice, packages and policy QA.",
    version="2.1.0",
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


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="rag-engine",
        qdrantCollection=settings.QDRANT_COLLECTION,
        llmModel=f"{settings.llm_provider}:{settings.active_llm_model}",
        embeddingModel=f"{settings.embedding_provider}:{settings.active_embedding_model}",
    )


@app.post(
    "/intent/detect",
    response_model=IntentDetectionResponse,
    tags=["RAG Chat"],
    summary="Detect intent bằng rules-first",
    description=(
        "Phân loại intent và trích xuất slot bằng rule/regex trước. "
        "Mặc định không gọi LLM nếu ENABLE_LLM_INTENT_FALLBACK=false."
    ),
)
def detect_intent(
    request: Annotated[
        IntentDetectionRequest,
        Body(openapi_examples=INTENT_DETECT_EXAMPLES),
    ],
) -> IntentDetectionResponse:
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    try:
        return intent_classifier.detect(request)
    except Exception as exc:
        logger.exception("intent/detect failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"intent detect failed: {exc}") from exc


@app.post(
    "/query",
    response_model=QueryResponse,
    tags=["RAG Chat"],
    summary="Query RAG + final answer",
    description=(
        "Build retrieval query bằng rules/preferences, search Qdrant, trim context, "
        "rồi gọi local LLM cho final answer tối đa 1 lần trong case bình thường. "
        "Bật DEBUG_RAG=true để xem llmCalls, rewriteUsed, contextChars, cacheHit."
    ),
)
def query(
    request: Annotated[
        QueryRequest,
        Body(openapi_examples=QUERY_EXAMPLES),
    ],
) -> QueryResponse:
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
    llm_calls = 0
    rewrite_used = False

    intent_result = _resolve_intent(request)
    intent = intent_result.intent

    if intent_result.shouldAskClarifyingQuestion and not request.productCandidates:
        return _clarification_response(request_id, intent_result, llm_calls=0)

    products = _slim_products(request.productCandidates)
    packages = _slim_packages(request.packageCandidates)
    request = request.model_copy(
        update={
            "productCandidates": products,
            "packageCandidates": packages,
            "question": normalize_question(request.question),
        }
    )

    top_k, score_threshold, max_context_chars = Retriever.retrieval_limits_for_intent(
        intent
    )
    # Nest gửi options — topK lấy theo Nest; scoreThreshold lấy mức thấp hơn (nới hơn)
    # để tránh Nest/Python lệch version chặn hết chunk (OpenRouter embed score ~0.1–0.3).
    if request.options:
        if request.options.topK and request.options.topK > 0:
            top_k = request.options.topK
        if (
            request.options.scoreThreshold is not None
            and 0.0 <= request.options.scoreThreshold <= 1.0
        ):
            score_threshold = min(score_threshold, float(request.options.scoreThreshold))

    retrieval_query = build_retrieval_query(
        question=request.question,
        user_preferences=request.userPreferences,
        last_intent=request.lastIntent,
        current_intent=intent,
        extracted_requirements=intent_result.extractedRequirements,
    )

    if should_rewrite_question(
        question=request.question,
        chat_history=request.chatHistory,
        user_preferences=request.userPreferences,
        last_intent=request.lastIntent,
        current_intent=intent,
        extracted=intent_result.extractedRequirements,
    ):
        retrieval_query = llm_client.rewrite_question(
            question=request.question,
            chat_history=request.chatHistory,
        )
        rewrite_used = True
        llm_calls += 1

    answer_cache_key = None
    if settings.CACHE_POLICY_ANSWERS and intent in (
        RagIntent.POLICY_QA,
        RagIntent.PACKAGE_QA,
    ):
        answer_cache_key = stable_hash(
            {
                "workspaceId": request.workspaceId,
                "intent": intent.value,
                "q": normalize_question(request.question).lower(),
                "documentIds": sorted(request.documentIds or []),
            }
        )
        cached_answer = answer_cache.get(answer_cache_key)
        if cached_answer:
            return _with_debug(
                QueryResponse(**cached_answer, requestId=request_id),
                QueryDebug(
                    llmCalls=0,
                    intentSource=intent_result.source,
                    rewriteUsed=False,
                    retrievalQuery=retrieval_query,
                    contextChars=cached_answer.get("usage", {}).get("contextChars", 0),
                    historyMessages=len(request.chatHistory),
                    cacheHit=True,
                    topK=top_k,
                    scoreThreshold=score_threshold,
                ),
            )

    chunks, qdrant_filter_used, fallback_used = _retrieve_context(
        request=request,
        intent=intent,
        retrieval_query=retrieval_query,
        retrieval_types=intent_result.retrievalTypes,
        top_k=top_k,
        score_threshold=score_threshold,
    )
    chunks = _prepare_chunks(chunks, score_threshold)
    context, used_chunks = Retriever.format_retrieved_context(
        chunks, max_context_chars, settings.MAX_SOURCES
    )

    # Log gọn thông tin retrieval theo intent/type/filter (không log full context).
    logger.info(
        "query requestId=%s intent=%s retrievalTypes=%s documentIds=%d "
        "qdrantFilterUsed=%s fallbackUsed=%s retrievedChunks=%d",
        request_id,
        intent.value,
        intent_result.retrievalTypes,
        len(request.documentIds or []),
        qdrant_filter_used,
        fallback_used,
        len(used_chunks),
    )

    debug_base = QueryDebug(
        llmCalls=llm_calls,
        intentSource=intent_result.source,
        rewriteUsed=rewrite_used,
        retrievalQuery=retrieval_query,
        contextChars=len(context or "") if used_chunks else 0,
        historyMessages=len(request.chatHistory),
        cacheHit=False,
        topK=top_k,
        scoreThreshold=score_threshold,
        intent=intent.value,
        retrievalTypes=intent_result.retrievalTypes,
        qdrantFilterUsed=qdrant_filter_used,
        retrievalFallbackUsed=fallback_used,
        retrievedChunks=len(used_chunks),
        documentIdsCount=len(request.documentIds or []),
    )

    # Zero-LLM: không có chunk knowledge → trả template ngay, tránh timeout LLM local.
    if not used_chunks:
        if intent == RagIntent.POLICY_QA:
            return _template_response(
                request_id=request_id,
                intent=intent,
                answer=TEMPLATE_NO_POLICY,
                intent_result=intent_result,
                products=[],
                packages=[],
                sources=[],
                debug=debug_base,
            )

        if intent == RagIntent.PACKAGE_QA:
            if packages:
                return _template_response(
                    request_id=request_id,
                    intent=intent,
                    answer=TEMPLATE_PACKAGE_NO_DOCS,
                    intent_result=intent_result,
                    products=[],
                    packages=packages,
                    sources=[],
                    debug=debug_base,
                )
            return _template_response(
                request_id=request_id,
                intent=intent,
                answer=TEMPLATE_NO_PACKAGE,
                intent_result=intent_result,
                products=[],
                packages=[],
                sources=[],
                debug=debug_base,
            )

        if intent == RagIntent.RING_RECOMMENDATION:
            if products:
                return _template_response(
                    request_id=request_id,
                    intent=intent,
                    answer=TEMPLATE_RING_PRODUCTS_NO_DOCS,
                    intent_result=intent_result,
                    products=products,
                    packages=[],
                    sources=[],
                    debug=debug_base,
                )
            return _template_response(
                request_id=request_id,
                intent=intent,
                answer=TEMPLATE_NO_PRODUCTS,
                intent_result=intent_result,
                products=[],
                packages=[],
                sources=[],
                debug=debug_base,
            )

        if intent == RagIntent.GEMSTONE_ADVICE:
            return _template_response(
                request_id=request_id,
                intent=intent,
                answer=TEMPLATE_GEMSTONE_NO_DOCS,
                intent_result=intent_result,
                products=products,
                packages=[],
                sources=[],
                debug=debug_base,
            )

        if intent == RagIntent.CUSTOM_DESIGN_CONSULTING:
            return _template_response(
                request_id=request_id,
                intent=intent,
                answer=TEMPLATE_CUSTOM_NO_DOCS,
                intent_result=intent_result,
                products=[],
                packages=packages,
                sources=[],
                debug=debug_base,
            )

        # GENERAL_RAG_QA và intent khác
        return _template_response(
            request_id=request_id,
            intent=intent,
            answer=TEMPLATE_NO_KNOWLEDGE,
            intent_result=intent_result,
            products=[],
            packages=[],
            sources=[],
            debug=debug_base,
        )

    _, llm_calls, response = _final_llm_answer(
        request=request,
        intent_result=intent_result,
        context=context,
        used_chunks=used_chunks,
        request_id=request_id,
        products=products if intent != RagIntent.POLICY_QA else [],
        packages=packages,
        llm_calls=llm_calls,
        rewrite_used=rewrite_used,
        retrieval_query=retrieval_query,
        debug_base=debug_base,
    )

    if answer_cache_key and settings.CACHE_POLICY_ANSWERS:
        answer_cache.set(
            answer_cache_key,
            response.model_dump(exclude={"requestId", "debug"}),
            settings.CACHE_ANSWER_TTL_SECONDS or settings.CACHE_TTL_SECONDS,
        )

    return response


def _final_llm_answer(
    *,
    request: QueryRequest,
    intent_result: IntentDetectionResponse,
    context: str,
    used_chunks: List[RetrievedChunk],
    request_id: str,
    products: List[ProductCandidate],
    packages: List[PackageCandidate],
    llm_calls: int,
    rewrite_used: bool,
    retrieval_query: str,
    debug_base: QueryDebug,
) -> tuple[str, int, QueryResponse]:
    system_prompt, user_prompt = prompt_builder.build(
        request=request,
        intent_result=intent_result,
        context=context,
    )
    llm_failed = False
    try:
        answer = llm_client.invoke_text(system_prompt, user_prompt)
        llm_calls += 1
    except Exception as exc:
        llm_failed = True
        logger.warning(
            "LLM unavailable, using extractive fallback: %s",
            str(exc).replace("\n", " ")[:240],
        )
        answer = _extractive_fallback_answer(
            question=request.question,
            chunks=used_chunks,
            context=context,
            error=exc,
        )

    response = QueryResponse(
        requestId=request_id,
        type=_response_type_for_intent(intent_result.intent),
        intent=intent_result.intent,
        answer=answer,
        sources=[chunk.source for chunk in used_chunks[: settings.MAX_SOURCES]],
        suggestedProducts=products[: settings.MAX_PRODUCT_CANDIDATES],
        suggestedPackages=packages[: settings.MAX_PACKAGE_CANDIDATES],
        missingFields=intent_result.missingFields,
        productFilters=intent_result.productFilters,
        shouldAskClarifyingQuestion=False,
        usage={
            "retrievalQuery": retrieval_query,
            "retrievedChunks": len(used_chunks),
            "retrievalTypes": intent_result.retrievalTypes,
            "qdrantFilterUsed": debug_base.qdrantFilterUsed,
            "retrievalFallbackUsed": debug_base.retrievalFallbackUsed,
            "contextChars": len(context or ""),
            "rewriteUsed": rewrite_used,
            "llmCalls": llm_calls,
            "llmFailed": llm_failed,
        },
    )
    # Giữ nguyên debug_base (đã có retrievalTypes/filter/fallback), chỉ cập nhật llmCalls.
    debug = debug_base.model_copy(
        update={"llmCalls": llm_calls, "contextChars": len(context or "")}
    )
    return answer, llm_calls, _with_debug(response, debug)


def _extractive_fallback_answer(
    *,
    question: str,
    chunks: List[RetrievedChunk],
    context: str,
    error: Exception,
) -> str:
    """User-facing answer when LLM is down — no ops/debug tips in chat text."""
    del question, error  # reserved for future ranking/tuning

    excerpts: list[str] = []
    for chunk in chunks[: settings.MAX_SOURCES]:
        text = (chunk.content or "").strip()
        if not text:
            continue
        # Gộp đoạn trích thành câu trả lời sạch, không kèm tên file / tip kỹ thuật.
        if len(text) > 420:
            text = text[:420].rstrip() + "..."
        excerpts.append(text)

    if not excerpts and context:
        trimmed = context.strip()
        if len(trimmed) > 1100:
            trimmed = trimmed[:1100].rstrip() + "..."
        excerpts.append(trimmed)

    if not excerpts:
        return (
            "Mình chưa tổng hợp được câu trả lời chi tiết lúc này. "
            "Bạn thử hỏi lại sau ít phút hoặc liên hệ nhân viên tư vấn nhé."
        )

    joined = "\n\n".join(excerpts)
    return (
        "Theo tài liệu chính sách của cửa hàng:\n\n"
        f"{joined}\n\n"
        "Nếu bạn cần mình làm rõ thêm (bảo hành, đổi trả, hủy đơn…), cứ hỏi tiếp nhé."
    )


def _prepare_chunks(
    chunks: List[RetrievedChunk], score_threshold: float
) -> List[RetrievedChunk]:
    filtered = Retriever.filter_low_score_chunks(chunks, score_threshold)
    return Retriever.deduplicate_chunks(filtered)


def _resolve_intent(request: QueryRequest) -> IntentDetectionResponse:
    detect_request = IntentDetectionRequest(
        question=request.question,
        chatHistory=request.chatHistory,
        conversationSummary=request.conversationSummary,
        userPreferences=request.userPreferences,
        lastIntent=request.lastIntent,
        language=request.options.language,
    )

    if not request.intentOverride:
        return intent_classifier.detect(detect_request)

    # Nest already detected intent — never call LLM again; rules fill gaps only.
    fallback = intent_classifier._detect_with_rules(detect_request)
    extracted = request.extractedRequirements or fallback.extractedRequirements
    if request.userPreferences:
        extracted = intent_classifier._merge_preferences(
            extracted, request.userPreferences
        )

    return IntentDetectionResponse(
        intent=request.intentOverride,
        confidence=1.0,
        source="rules",
        llmUsed=False,
        extractedRequirements=extracted,
        missingFields=request.missingFields or fallback.missingFields,
        retrievalTypes=request.retrievalTypes or fallback.retrievalTypes,
        productFilters=request.productFilters or fallback.productFilters,
        shouldAskClarifyingQuestion=False,
    )


def _retrieve_context(
    request: QueryRequest,
    intent: RagIntent,
    retrieval_query: str,
    retrieval_types: List[str],
    top_k: int,
    score_threshold: float,
) -> tuple[List[RetrievedChunk], bool, bool]:
    """Trả (chunks, qdrant_filter_used, retrieval_fallback_used)."""
    apply_type_filter = Retriever.should_apply_type_filter(intent, retrieval_types)

    def _do_search(apply_filter: bool) -> List[RetrievedChunk]:
        cache_key = None
        if settings.CACHE_RETRIEVAL_RESULTS:
            cache_key = stable_hash(
                {
                    "workspaceId": request.workspaceId,
                    "q": retrieval_query,
                    "types": retrieval_types if apply_filter else [],
                    "filter": apply_filter,
                    "topK": top_k,
                    "score": score_threshold,
                    "documentIds": sorted(request.documentIds or []),
                }
            )
            cached = retrieval_cache.get(cache_key)
            if cached is not None:
                return [RetrievedChunk(**item) for item in cached]

        try:
            found = retriever.search(
                query=retrieval_query,
                workspace_id=request.workspaceId,
                document_ids=request.documentIds,
                retrieval_types=retrieval_types,
                apply_type_filter=apply_filter,
                top_k=top_k,
                score_threshold=score_threshold,
            )
        except Exception as exc:
            # Collection chưa tạo / Qdrant lỗi → coi như 0 chunk để trả template thân thiện (không 500).
            logger.warning(
                "retrieval failed (treat as empty knowledge): %s",
                exc,
            )
            return []

        if cache_key and settings.CACHE_RETRIEVAL_RESULTS:
            retrieval_cache.set(
                cache_key,
                [c.model_dump() for c in found],
                settings.CACHE_TTL_SECONDS,
            )
        return found

    chunks = _do_search(apply_type_filter)
    fallback_used = False

    # Fallback: filter theo type không ra chunk -> thử lại bỏ filter type (giữ documentIds).
    if (
        not chunks
        and apply_type_filter
        and settings.ENABLE_RETRIEVAL_FALLBACK
    ):
        logger.warning(
            "retrieval empty with type filter=%s -> fallback without type filter "
            "(reindex old docs to add retrieval_types)",
            retrieval_types,
        )
        chunks = _do_search(False)
        fallback_used = True
        apply_type_filter = False

    return chunks, apply_type_filter, fallback_used


def _slim_products(products: List[ProductCandidate]) -> List[ProductCandidate]:
    slim: List[ProductCandidate] = []
    for product in products[: settings.MAX_PRODUCT_CANDIDATES]:
        short = product.shortDescription or product.description
        if short and len(short) > 280:
            short = short[:277] + "..."
        slim.append(
            ProductCandidate(
                id=product.id,
                name=product.name,
                price=product.price,
                material=product.material,
                style=product.style,
                purpose=product.purpose,
                stoneName=product.stoneName,
                stoneColor=product.stoneColor,
                imageUrl=product.imageUrl,
                tags=(product.tags or [])[:10],
                shortDescription=short,
                description=None,
                reason=product.reason,
            )
        )
    return slim


def _slim_packages(packages: List[PackageCandidate]) -> List[PackageCandidate]:
    slim: List[PackageCandidate] = []
    for pkg in packages[: settings.MAX_PACKAGE_CANDIDATES]:
        short = pkg.shortDescription or pkg.description
        if short and len(short) > 280:
            short = short[:277] + "..."
        slim.append(
            PackageCandidate(
                id=pkg.id,
                name=pkg.name,
                price=pkg.price,
                shortDescription=short,
                description=None,
                includedServices=(pkg.includedServices or [])[:12],
                estimatedDays=pkg.estimatedDays,
                warranty=pkg.warranty,
            )
        )
    return slim


def _clarification_response(
    request_id: str,
    intent_result: IntentDetectionResponse,
    llm_calls: int,
) -> QueryResponse:
    response = QueryResponse(
        requestId=request_id,
        type="clarification",
        intent=RagIntent.CLARIFICATION,
        answer=intent_result.clarificationQuestion
        or "Bạn có thể cho mình biết ngân sách, dịp sử dụng và phong cách bạn thích không?",
        missingFields=intent_result.missingFields,
        productFilters=intent_result.productFilters,
        shouldAskClarifyingQuestion=True,
        usage={"llmCalls": 0},
    )
    return _with_debug(
        response,
        QueryDebug(
            llmCalls=llm_calls,
            intentSource=intent_result.source,
            rewriteUsed=False,
            retrievalQuery=None,
            contextChars=0,
            historyMessages=0,
            cacheHit=False,
        ),
    )


def _template_response(
    *,
    request_id: str,
    intent: RagIntent,
    answer: str,
    intent_result: IntentDetectionResponse,
    products: List[ProductCandidate],
    packages: List[PackageCandidate],
    sources: list,
    debug: QueryDebug,
) -> QueryResponse:
    response = QueryResponse(
        requestId=request_id,
        type=_response_type_for_intent(intent),
        intent=intent,
        answer=answer,
        sources=sources,
        suggestedProducts=products,
        suggestedPackages=packages,
        missingFields=intent_result.missingFields,
        productFilters=intent_result.productFilters,
        shouldAskClarifyingQuestion=False,
        usage={
            "llmCalls": debug.llmCalls,
            "template": True,
            "retrievalQuery": debug.retrievalQuery,
        },
    )
    return _with_debug(response, debug)


def _with_debug(response: QueryResponse, debug: QueryDebug) -> QueryResponse:
    if settings.debug_enabled:
        response.debug = debug
    return response


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
