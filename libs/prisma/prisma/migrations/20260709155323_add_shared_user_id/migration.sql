-- AlterTable
ALTER TABLE "engravings" ADD COLUMN     "guest_customer_id" UUID;

-- AlterTable
ALTER TABLE "qr_memories" ADD COLUMN     "shared_at" TIMESTAMPTZ(6),
ADD COLUMN     "shared_user_id" UUID;

-- CreateIndex
CREATE INDEX "qr_memories_shared_user_id_idx" ON "qr_memories"("shared_user_id");

-- AddForeignKey
ALTER TABLE "qr_memories" ADD CONSTRAINT "qr_memories_shared_user_id_fkey" FOREIGN KEY ("shared_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
