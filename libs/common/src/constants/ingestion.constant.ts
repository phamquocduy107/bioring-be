export const INGESTION_ROUTING_KEYS = {
  INGEST: 'document.ingestion.requested',
  REINDEX: 'document.ingestion.reindex',
  DELETE_VECTORS: 'document.vectors.delete',
  STATUS: 'document.ingestion.status',
  FAILED: 'document.ingestion.failed',
} as const;

export type IngestionJobType = 'INGEST' | 'REINDEX' | 'DELETE_VECTORS';

export type IngestionWorkerStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export interface IngestionJobPayload {
  jobId: string;
  jobType: IngestionJobType;
  documentId: string;
  workspaceId: string;
  userId?: string;
  bucket?: string;
  objectName?: string;
  originalName?: string;
  /** Loại tài liệu để worker gắn metadata + Qdrant filter theo intent. */
  documentType?: string;
  /** Các retrieval type gắn vào từng chunk (map từ documentType nếu rỗng). */
  retrievalTypes?: string[];
  createdAt?: string;
}

export interface IngestionStatusEvent {
  jobId?: string;
  jobType?: string;
  documentId: string;
  workspaceId?: string;
  status: IngestionWorkerStatus;
  progress?: number;
  message?: string;
  errorMessage?: string;
  chunkCount?: number;
  updatedAt: string;
}

export function mapIngestionWorkerStatusToDb(
  status: IngestionWorkerStatus,
): string | null {
  switch (status) {
    case 'UPLOADED':
      return 'PENDING';
    case 'PROCESSING':
      return 'PROCESSING';
    case 'READY':
      return 'COMPLETED';
    case 'FAILED':
      return 'FAILED';
    default:
      return null;
  }
}
