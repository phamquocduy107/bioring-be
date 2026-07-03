-- Add selected_biometrics column to engraving_versions
ALTER TABLE "engraving_versions" ADD COLUMN "selected_biometrics" VARCHAR(100);

-- Drop old FK from engravings.order_id
ALTER TABLE "engravings" DROP CONSTRAINT IF EXISTS "engravings_order_id_fkey";
DROP INDEX IF EXISTS "engravings_order_id_idx";

-- Add engraving_id to orders (nullable first for data migration)
ALTER TABLE "orders" ADD COLUMN "engraving_id" UUID;

-- Migrate existing data: copy engraving.id where engravings.order_id = orders.id
UPDATE "orders" o
SET "engraving_id" = e.id
FROM "engravings" e
WHERE e.order_id = o.id;

-- Drop the old order_id column from engravings
ALTER TABLE "engravings" DROP COLUMN "order_id";

-- Make engraving_id NOT NULL now that data is migrated
ALTER TABLE "orders" ALTER COLUMN "engraving_id" SET NOT NULL;

-- Add unique constraint
CREATE UNIQUE INDEX "orders_engraving_id_key" ON "orders"("engraving_id");

-- Add FK constraint
ALTER TABLE "orders" ADD CONSTRAINT "orders_engraving_id_fkey" FOREIGN KEY ("engraving_id") REFERENCES "engravings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
