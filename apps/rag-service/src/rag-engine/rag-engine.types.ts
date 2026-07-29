import type {
  PackageCandidate,
  ProductCandidate,
} from '../catalog/catalog.types';
import type {
  ChatHistoryMessage,
  RagSource,
  UserPreferences,
} from '../chat/chat.types';
import type { SuggestionChip } from '../chat/suggestion-chips.util';

/** Intent enum aligned with Python rag-engine. */
export type RagIntent =
  | 'RING_RECOMMENDATION'
  | 'GEMSTONE_ADVICE'
  | 'PACKAGE_QA'
  | 'POLICY_QA'
  | 'GENERAL_RAG_QA'
  | 'CLARIFICATION';

export type ExtractedRequirements = UserPreferences;

export interface ClarificationOption {
  label: string;
  value: string;
}

export interface ClarificationData {
  field: string;
  question: string;
  inputType: 'chips' | 'slider';
  options?: ClarificationOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface IntentDetectionResponse {
  intent: RagIntent;
  confidence: number;
  source?: 'rules' | 'llm';
  llmUsed?: boolean;
  extractedRequirements: ExtractedRequirements;
  missingFields: string[];
  retrievalTypes: string[];
  productFilters: Record<string, unknown>;
  shouldAskClarifyingQuestion: boolean;
  clarificationQuestion?: string | null;
  clarificationData?: ClarificationData | null;
}

/** Payload for POST ${RAG_ENGINE_URL}/query */
export interface RagQueryRequest {
  requestId: string;
  userId: string;
  workspaceId: string;
  documentIds: string[];
  question: string;
  chatHistory: ChatHistoryMessage[];
  conversationSummary?: string;
  userPreferences?: UserPreferences;
  lastIntent?: string | null;
  intentOverride: RagIntent;
  extractedRequirements: ExtractedRequirements;
  retrievalTypes: string[];
  productFilters: Record<string, unknown>;
  missingFields: string[];
  productCandidates: ProductCandidate[];
  packageCandidates: PackageCandidate[];
  options: {
    topK: number;
    scoreThreshold: number;
    language: 'vi' | 'en';
  };
}

export interface RagQueryDebug {
  llmCalls?: number;
  intentSource?: string;
  rewriteUsed?: boolean;
  retrievalQuery?: string;
  contextChars?: number;
  historyMessages?: number;
  cacheHit?: boolean;
  topK?: number;
  scoreThreshold?: number;
}

/** Response from POST ${RAG_ENGINE_URL}/query */
export interface RagQueryResponse {
  requestId?: string;
  type: string;
  intent: RagIntent;
  answer: string;
  sources: RagSource[];
  suggestedProducts: ProductCandidate[];
  suggestedPackages: PackageCandidate[];
  missingFields: string[];
  productFilters: Record<string, unknown>;
  shouldAskClarifyingQuestion: boolean;
  clarificationData?: ClarificationData | null;
  suggestionChips?: SuggestionChip[] | null;
  usage?: Record<string, unknown> | null;
  debug?: RagQueryDebug | null;
}

/** Intents that typically carry ring shopping preferences. */
export const PREFERENCE_BEARING_INTENTS: RagIntent[] = [
  'RING_RECOMMENDATION',
  'GEMSTONE_ADVICE',
];

export function retrievalOptionsForIntent(intent: RagIntent): {
  topK: number;
  scoreThreshold: number;
} {
  // OpenRouter nvidia/nemotron-3-embed cosine scores thường ~0.1–0.3 (không ~0.5+ như BGE local).
  switch (intent) {
    case 'POLICY_QA':
      return { topK: 3, scoreThreshold: 0.12 };
    case 'PACKAGE_QA':
      return { topK: 3, scoreThreshold: 0.12 };
    case 'RING_RECOMMENDATION':
    case 'GEMSTONE_ADVICE':
      return { topK: 4, scoreThreshold: 0.1 };
    default:
      return { topK: 4, scoreThreshold: 0.12 };
  }
}
