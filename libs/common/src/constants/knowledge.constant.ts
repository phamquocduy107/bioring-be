export const DEFAULT_KNOWLEDGE_WORKSPACE_ID = 'bioring-catalog';

/** Max PDF upload size (20 MiB). Keep in sync with gRPC message limits. */
export const KNOWLEDGE_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const KNOWLEDGE_GRPC_CHANNEL_OPTIONS = {
  'grpc.max_receive_message_length': KNOWLEDGE_MAX_UPLOAD_BYTES,
  'grpc.max_send_message_length': KNOWLEDGE_MAX_UPLOAD_BYTES,
} as const;

export function getKnowledgeWorkspaceId(): string {
  return (
    process.env.KNOWLEDGE_DEFAULT_WORKSPACE_ID ?? DEFAULT_KNOWLEDGE_WORKSPACE_ID
  );
}
