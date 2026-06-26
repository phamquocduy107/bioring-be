-- DropForeignKey
ALTER TABLE "engravings" DROP CONSTRAINT "engravings_id_fkey";

-- DropForeignKey
ALTER TABLE "engravings" DROP CONSTRAINT "engravings_id_fkey1";

-- AddForeignKey
ALTER TABLE "qr_memories" ADD CONSTRAINT "qr_memories_engraving_id_fkey" FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_engraving_id_fkey" FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
