export const DEFAULT_KNOWLEDGE_WORKSPACE_ID = 'bioring-catalog';

/** Max PDF upload size (50 MiB). Keep in sync with gRPC message limits. */
export const KNOWLEDGE_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Presigned MinIO GET URL TTL for document preview/download (15 minutes). */
export const KNOWLEDGE_DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

export const KNOWLEDGE_GRPC_CHANNEL_OPTIONS = {
  'grpc.max_receive_message_length': KNOWLEDGE_MAX_UPLOAD_BYTES,
  'grpc.max_send_message_length': KNOWLEDGE_MAX_UPLOAD_BYTES,
} as const;

/** Avoid protobuf Long objects leaking into HTTP JSON (size became { low, high }). */
export const KNOWLEDGE_GRPC_LOADER_OPTIONS = {
  keepCase: false,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
} as const;

export function getKnowledgeWorkspaceId(): string {
  return (
    process.env.KNOWLEDGE_DEFAULT_WORKSPACE_ID ?? DEFAULT_KNOWLEDGE_WORKSPACE_ID
  );
}
