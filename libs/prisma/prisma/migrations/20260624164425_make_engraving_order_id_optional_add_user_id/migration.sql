-- AlterTable
ALTER TABLE "engravings" ADD COLUMN     "user_id" UUID,
ALTER COLUMN "order_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "engravings" ADD CONSTRAINT "engravings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
