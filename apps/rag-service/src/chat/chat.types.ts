import type {
  PackageCandidate,
  ProductCandidate,
} from '../catalog/catalog.types';

export const MAX_RECENT_MESSAGES = Number(process.env.MAX_RECENT_MESSAGES ?? 8);
export const MAX_AMBIGUOUS_RECENT_MESSAGES = Number(
  process.env.MAX_AMBIGUOUS_RECENT_MESSAGES ?? 12,
);
export const MAX_HISTORY_TOKENS = Number(
  process.env.MAX_HISTORY_TOKENS ?? 1200,
);
export const MAX_PRODUCT_CANDIDATES = Number(
  process.env.MAX_PRODUCT_CANDIDATES ?? 5,
);
export const MAX_PACKAGE_CANDIDATES = Number(
  process.env.MAX_PACKAGE_CANDIDATES ?? 3,
);
export const SUMMARY_TRIGGER_MESSAGE_COUNT = 12;
export const SUMMARY_REGENERATE_EVERY = 10;

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

export interface UserPreferences {
  purpose?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  style?: string | null;
  material?: string | null;
  stoneColor?: string | null;
  stoneName?: string | null;
  ringSize?: string | null;
  customDesign?: boolean | null;
  occasion?: string | null;
  recipient?: string | null;
  customSignal?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

/** Citation / source chunk attached to assistant messages. */
export interface RagSource {
  documentId?: string;
  source?: string;
  page?: number;
  chunkIndex?: number;
  score?: number;
  contentPreview?: string;
}

export interface ChatAskPayload {
  userId: string;
  workspaceId: string;
  chatSessionId?: string;
  documentIds?: string[];
  question: string;
}

export interface ChatAskResponse {
  messageId: string;
  sessionId: string;
  type: string;
  intent: string;
  answer: string;
  sources: RagSource[];
  suggestedProducts: ProductCandidate[];
  suggestedPackages: PackageCandidate[];
  missingFields: string[];
  productFiltersJson: string;
  shouldAskClarifyingQuestion: boolean;
}

export interface ChatContext {
  chatHistory: ChatHistoryMessage[];
  conversationSummary?: string;
  userPreferences: UserPreferences;
  lastIntent?: string | null;
}

export interface MessageMetadata {
  intent?: string;
  type?: string;
  sources?: RagSource[];
  suggestedProducts?: ProductCandidate[];
  suggestedPackages?: PackageCandidate[];
  productFilters?: Record<string, unknown>;
  missingFields?: string[];
  usage?: Record<string, unknown> | null;
}
