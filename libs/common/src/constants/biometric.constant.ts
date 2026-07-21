/** Max biometric multipart upload (50 MiB). Keep in sync with gRPC message limits. */
export const BIOMETRIC_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const BIOMETRIC_GRPC_CHANNEL_OPTIONS = {
  'grpc.max_receive_message_length': BIOMETRIC_MAX_UPLOAD_BYTES,
  'grpc.max_send_message_length': BIOMETRIC_MAX_UPLOAD_BYTES,
} as const;
