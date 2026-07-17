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
    CUSTOM_DESIGN_CONSULTING = "CUSTOM_DESIGN_CONSULTING"
    GENERAL_RAG_QA = "GENERAL_RAG_QA"
    CLARIFICATION = "CLARIFICATION"


class QueryOptions(BaseModel):
    topK: int = Field(default=5, ge=1, le=20)
    scoreThreshold: float = Field(default=0.45, ge=0.0, le=1.0)
    language: Literal["vi", "en"] = "vi"


class ExtractedRequirements(BaseModel):
    purpose: Optional[str] = None
    budgetMin: Optional[int] = None
    budgetMax: Optional[int] = None
    style: Optional[str] = None
    material: Optional[str] = None
    stoneName: Optional[str] = None
    stoneColor: Optional[str] = None
    ringSize: Optional[str] = None
    occasion: Optional[str] = None
    recipient: Optional[str] = None
    customSignal: Optional[str] = None  # voice, fingerprint, biometric, handwriting, etc.
    notes: Optional[str] = None


class IntentDetectionRequest(BaseModel):
    question: str
    chatHistory: List[ChatMessage] = Field(default_factory=list)
    conversationSummary: Optional[str] = None
    userPreferences: Dict[str, Any] = Field(default_factory=dict)
    lastIntent: Optional[str] = None
    language: Literal["vi", "en"] = "vi"


class IntentDetectionResponse(BaseModel):
    intent: RagIntent
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    extractedRequirements: ExtractedRequirements = Field(default_factory=ExtractedRequirements)
    missingFields: List[str] = Field(default_factory=list)
    retrievalTypes: List[str] = Field(default_factory=list)
    productFilters: Dict[str, Any] = Field(default_factory=dict)
    shouldAskClarifyingQuestion: bool = False
    clarificationQuestion: Optional[str] = None


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
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    reason: Optional[str] = None


class PackageCandidate(BaseModel):
    id: str
    name: str
    price: Optional[int] = None
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

    # Passed by NestJS if it already called /intent/detect.
    intentOverride: Optional[RagIntent] = None
    extractedRequirements: Optional[ExtractedRequirements] = None
    retrievalTypes: List[str] = Field(default_factory=list)
    productFilters: Dict[str, Any] = Field(default_factory=dict)
    missingFields: List[str] = Field(default_factory=list)

    # Structured data from NestJS/ecommerce/product service.
    productCandidates: List[ProductCandidate] = Field(default_factory=list)
    packageCandidates: List[PackageCandidate] = Field(default_factory=list)


class Source(BaseModel):
    documentId: Optional[str] = None
    source: Optional[str] = None
    page: Optional[int] = None
    chunkIndex: Optional[int] = None
    score: Optional[float] = None
    contentPreview: Optional[str] = None


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
    usage: Dict[str, Any] = Field(default_factory=dict)


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
