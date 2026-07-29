from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatRole(str, Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class ChatMessage(BaseModel):
    role: ChatRole
    content: str


class RagIntent(str, Enum):
    RING_RECOMMENDATION = "RING_RECOMMENDATION"
    GEMSTONE_ADVICE = "GEMSTONE_ADVICE"
    PACKAGE_QA = "PACKAGE_QA"
    POLICY_QA = "POLICY_QA"
    GENERAL_RAG_QA = "GENERAL_RAG_QA"
    CLARIFICATION = "CLARIFICATION"


class QueryOptions(BaseModel):
    topK: int = Field(default=4, ge=1, le=20)
    scoreThreshold: float = Field(default=0.50, ge=0.0, le=1.0)
    language: Literal["vi", "en"] = "vi"


class ExtractedRequirements(BaseModel):
    purpose: Optional[str] = None
    budgetMin: Optional[int] = None
    budgetMax: Optional[int] = None
    budgetApprox: Optional[int] = None
    style: Optional[str] = None
    material: Optional[str] = None
    stoneName: Optional[str] = None
    stoneColor: Optional[str] = None
    ringSize: Optional[str] = None
    occasion: Optional[str] = None
    recipient: Optional[str] = None
    customSignal: Optional[str] = None
    notes: Optional[str] = None


class IntentDetectionRequest(BaseModel):
    question: str
    chatHistory: List[ChatMessage] = Field(default_factory=list)
    conversationSummary: Optional[str] = None
    userPreferences: Dict[str, Any] = Field(default_factory=dict)
    lastIntent: Optional[str] = None
    language: Literal["vi", "en"] = "vi"


class ClarificationOption(BaseModel):
    """One selectable option in a clarification prompt."""
    label: str
    value: str


class ClarificationData(BaseModel):
    """Structured clarification payload for FE to render chips / slider."""
    field: str
    question: str
    inputType: Literal["chips", "slider"] = "chips"
    options: List[ClarificationOption] = Field(default_factory=list)
    # slider-specific
    min: Optional[int] = None
    max: Optional[int] = None
    step: Optional[int] = None
    unit: Optional[str] = None


class IntentDetectionResponse(BaseModel):
    intent: RagIntent
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source: Literal["rules", "llm"] = "rules"
    llmUsed: bool = False
    extractedRequirements: ExtractedRequirements = Field(default_factory=ExtractedRequirements)
    missingFields: List[str] = Field(default_factory=list)
    retrievalTypes: List[str] = Field(default_factory=list)
    productFilters: Dict[str, Any] = Field(default_factory=dict)
    shouldAskClarifyingQuestion: bool = False
    clarificationQuestion: Optional[str] = None
    clarificationData: Optional[ClarificationData] = None


class ProductCandidate(BaseModel):
    id: str
    name: str
    price: Optional[int] = None
    material: Optional[str] = None
    style: Optional[str] = None
    purpose: Optional[str] = None
    stoneName: Optional[str] = None
    stoneColor: Optional[str] = None
    imageUrl: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    shortDescription: Optional[str] = None
    # Backward-compatible alias; prompt prefers shortDescription.
    description: Optional[str] = None
    reason: Optional[str] = None


class PackageCandidate(BaseModel):
    id: str
    name: str
    price: Optional[int] = None
    shortDescription: Optional[str] = None
    description: Optional[str] = None
    includedServices: List[str] = Field(default_factory=list)
    estimatedDays: Optional[int] = None
    warranty: Optional[str] = None


class QueryRequest(BaseModel):
    requestId: Optional[str] = None
    userId: Optional[str] = None
    workspaceId: str
    documentIds: List[str] = Field(default_factory=list)
    question: str
    chatHistory: List[ChatMessage] = Field(default_factory=list)
    conversationSummary: Optional[str] = None
    userPreferences: Dict[str, Any] = Field(default_factory=dict)
    lastIntent: Optional[str] = None
    options: QueryOptions = Field(default_factory=QueryOptions)

    intentOverride: Optional[RagIntent] = None
    extractedRequirements: Optional[ExtractedRequirements] = None
    retrievalTypes: List[str] = Field(default_factory=list)
    productFilters: Dict[str, Any] = Field(default_factory=dict)
    missingFields: List[str] = Field(default_factory=list)

    productCandidates: List[ProductCandidate] = Field(default_factory=list)
    packageCandidates: List[PackageCandidate] = Field(default_factory=list)


class Source(BaseModel):
    documentId: Optional[str] = None
    source: Optional[str] = None
    page: Optional[int] = None
    chunkIndex: Optional[int] = None
    score: Optional[float] = None
    contentPreview: Optional[str] = None


class QueryDebug(BaseModel):
    llmCalls: int = 0
    intentSource: Optional[str] = None
    rewriteUsed: bool = False
    retrievalQuery: Optional[str] = None
    contextChars: int = 0
    historyMessages: int = 0
    cacheHit: bool = False
    topK: Optional[int] = None
    scoreThreshold: Optional[float] = None
    intent: Optional[str] = None
    retrievalTypes: List[str] = Field(default_factory=list)
    qdrantFilterUsed: bool = False
    retrievalFallbackUsed: bool = False
    retrievedChunks: int = 0
    documentIdsCount: int = 0


class QueryResponse(BaseModel):
    requestId: Optional[str] = None
    type: str
    intent: RagIntent
    answer: str
    sources: List[Source] = Field(default_factory=list)
    suggestedProducts: List[ProductCandidate] = Field(default_factory=list)
    suggestedPackages: List[PackageCandidate] = Field(default_factory=list)
    missingFields: List[str] = Field(default_factory=list)
    productFilters: Dict[str, Any] = Field(default_factory=dict)
    shouldAskClarifyingQuestion: bool = False
    clarificationData: Optional[ClarificationData] = None
    usage: Dict[str, Any] = Field(default_factory=dict)
    debug: Optional[QueryDebug] = None


class RetrievedChunk(BaseModel):
    content: str
    source: Source
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str
    service: str
    qdrantCollection: str
    llmModel: str
    embeddingModel: str
