-- P3: move checklist URLs into biometric_assets, drop capture tables

-- 1) Backfill assets for checklist rows that still store raw/svg URLs
INSERT INTO "biometric_assets" (
  "id",
  "artifact_id",
  "asset_type",
  "status",
  "approved_files",
  "engraving_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  'migrated_' || eb."id"::text,
  CASE eb."biometric_type"
    WHEN 'FP' THEN 'fingerprint'
    WHEN 'SW' THEN 'soundwave'
    WHEN 'HB' THEN 'heartbeat'
    ELSE lower(eb."biometric_type")
  END,
  COALESCE(eb."status", 'CAPTURED'),
  jsonb_build_object(
    'productionFiles', jsonb_build_object('svg', COALESCE(eb."processed_svg_url", '')),
    'sourceFiles', jsonb_build_object('raw', COALESCE(eb."raw_file_url", ''))
  ),
  eb."engraving_id",
  COALESCE(eb."created_at", NOW()),
  COALESCE(eb."updated_at", NOW())
FROM "engraving_biometrics" eb
WHERE eb."biometric_asset_id" IS NULL
  AND (eb."raw_file_url" IS NOT NULL OR eb."processed_svg_url" IS NOT NULL);

UPDATE "engraving_biometrics" eb
SET "biometric_asset_id" = ba."id"
FROM "biometric_assets" ba
WHERE eb."biometric_asset_id" IS NULL
  AND ba."engraving_id" = eb."engraving_id"
  AND ba."artifact_id" = 'migrated_' || eb."id"::text;

-- 2) Drop legacy URL columns from checklist
ALTER TABLE "engraving_biometrics" DROP COLUMN IF EXISTS "raw_file_url";
ALTER TABLE "engraving_biometrics" DROP COLUMN IF EXISTS "processed_svg_url";

-- 3) Drop capture session stack
ALTER TABLE "staff_assignments" DROP CONSTRAINT IF EXISTS "staff_assignments_capture_session_id_fkey";
ALTER TABLE "staff_assignments" DROP COLUMN IF EXISTS "capture_session_id";

DROP TABLE IF EXISTS "biometric_capture_items";
DROP TABLE IF EXISTS "biometric_capture_sessions";
