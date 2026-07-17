-- AlterTable: add document_type + retrieval_types for Qdrant metadata filtering
ALTER TABLE "knowledge_documents"
ADD COLUMN IF NOT EXISTS "document_type" VARCHAR(100) NOT NULL DEFAULT 'general';

ALTER TABLE "knowledge_documents"
ADD COLUMN IF NOT EXISTS "retrieval_types" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "knowledge_documents_workspace_id_document_type_idx"
ON "knowledge_documents"("workspace_id", "document_type");

CREATE INDEX IF NOT EXISTS "knowledge_documents_status_idx"
ON "knowledge_documents"("status");
