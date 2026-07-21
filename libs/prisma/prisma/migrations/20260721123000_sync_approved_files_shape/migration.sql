-- Sync existing approved_files to canonical shape (sourceFiles.raw + productionFiles.audioOriginal for SW)
UPDATE "biometric_assets"
SET "approved_files" = jsonb_set(
  "approved_files",
  '{productionFiles,audioOriginal}',
  "approved_files"#>'{sourceFiles,raw}',
  true
)
WHERE "asset_type" = 'soundwave'
  AND "approved_files" IS NOT NULL
  AND "approved_files"#>>'{sourceFiles,raw}' IS NOT NULL
  AND "approved_files"#>>'{productionFiles,audioOriginal}' IS NULL;

UPDATE "biometric_assets"
SET "approved_files" = jsonb_set(
  COALESCE("approved_files", '{}'::jsonb),
  '{sourceFiles}',
  jsonb_build_object(
    'raw',
    COALESCE(
      "approved_files"#>>'{sourceFiles,raw}',
      "approved_files"#>>'{productionFiles,audioOriginal}',
      ''
    )
  ),
  true
)
WHERE "approved_files" IS NOT NULL
  AND (
    "approved_files"#>>'{sourceFiles,raw}' IS NULL
    OR NOT ("approved_files" ? 'sourceFiles')
  );
