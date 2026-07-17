-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "workspace_id" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "original_name" VARCHAR(500) NOT NULL,
    "mimetype" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_key" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_documents_workspace_id_user_id_created_at_idx" ON "knowledge_documents"("workspace_id", "user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
