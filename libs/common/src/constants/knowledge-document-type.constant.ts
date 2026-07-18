/**
 * Loại tài liệu knowledge + retrieval types dùng để filter Qdrant theo chat intent.
 * Dùng chung giữa api-gateway, rag-service. Python rag-engine giữ bản mapping riêng
 * (rag-python) nhưng phải đồng bộ giá trị với file này.
 */

export const DOCUMENT_TYPES = [
  'policy',
  'package',
  'ring_guide',
  'gemstone_guide',
  'custom_design',
  'general',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const RETRIEVAL_TYPES = [
  'policy',
  'package',
  'ring_guide',
  'gemstone_guide',
  'custom_design',
  'general',
] as const;

export type RetrievalType = (typeof RETRIEVAL_TYPES)[number];

export const DEFAULT_DOCUMENT_TYPE: DocumentType = 'general';

/** Mặc định 1 document_type map sang các retrieval_types nào (1 tài liệu phục vụ nhiều intent). */
export const DOCUMENT_TYPE_TO_RETRIEVAL_TYPES: Record<
  DocumentType,
  RetrievalType[]
> = {
  policy: ['policy'],
  package: ['package', 'policy'],
  ring_guide: ['ring_guide', 'gemstone_guide'],
  gemstone_guide: ['gemstone_guide', 'ring_guide'],
  custom_design: ['custom_design', 'package', 'policy', 'ring_guide'],
  general: ['general'],
};

export function isDocumentType(value: unknown): value is DocumentType {
  return (
    typeof value === 'string' &&
    (DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

export function isRetrievalType(value: unknown): value is RetrievalType {
  return (
    typeof value === 'string' &&
    (RETRIEVAL_TYPES as readonly string[]).includes(value)
  );
}

/** Chuẩn hóa document_type; giá trị lạ → general. */
export function normalizeDocumentType(value?: string | null): DocumentType {
  return isDocumentType(value) ? value : DEFAULT_DOCUMENT_TYPE;
}

/**
 * Chuẩn hóa retrieval_types:
 * - Nếu client gửi list hợp lệ (sau khi lọc) thì dùng.
 * - Nếu rỗng/không hợp lệ thì auto map từ document_type.
 */
export function normalizeRetrievalTypes(
  retrievalTypes: string[] | undefined | null,
  documentType: DocumentType,
): RetrievalType[] {
  const filtered = (retrievalTypes ?? []).filter(isRetrievalType);
  const unique = Array.from(new Set(filtered));
  if (unique.length > 0) {
    return unique;
  }
  return DOCUMENT_TYPE_TO_RETRIEVAL_TYPES[documentType] ?? ['general'];
}
