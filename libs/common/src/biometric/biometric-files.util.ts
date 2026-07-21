/**
 * Canonical biometric file bundle for biometric_assets.approved_files /
 * review_files — shared by ecommerce + personalization_engine.
 *
 * {
 *   viewerFiles?: { ...texture maps },
 *   productionFiles: {
 *     svg: string,
 *     waveformPoints?: string,
 *     audioOriginal?: string,  // SW: same as sourceFiles.raw
 *     audioSegment?: string,
 *   },
 *   sourceFiles: { raw: string }  // FP input | SW audio | HB raw
 * }
 */

export const CHECKLIST_TO_ASSET_TYPE: Record<string, string> = {
  FP: 'fingerprint',
  SW: 'soundwave',
  HB: 'heartbeat',
};

export const ASSET_TYPE_TO_CHECKLIST: Record<string, string> = {
  fingerprint: 'FP',
  soundwave: 'SW',
  heartbeat: 'HB',
};

export type BiometricSourceFiles = {
  raw: string;
};

export type BiometricProductionFiles = {
  svg: string;
  waveformPoints?: string;
  audioOriginal?: string;
  audioSegment?: string;
};

export type BiometricApprovedFiles = {
  viewerFiles?: Record<string, string>;
  productionFiles: BiometricProductionFiles;
  sourceFiles: BiometricSourceFiles;
};

type LooseFiles = {
  viewerFiles?: Record<string, string>;
  productionFiles?: Partial<BiometricProductionFiles> & Record<string, unknown>;
  sourceFiles?: { raw?: string };
  audioOriginal?: string;
  audioSegment?: string;
  debugFiles?: { inputPng?: string };
};

/** Ecommerce attach → canonical bundle (Python-compatible). */
export function buildEcommerceApprovedFiles(
  rawFileUrl: string,
  processedSvgUrl: string,
  assetType: string,
): BiometricApprovedFiles {
  const productionFiles: BiometricProductionFiles = {
    svg: processedSvgUrl,
  };
  if (assetType === 'soundwave') {
    productionFiles.audioOriginal = rawFileUrl;
  }
  return {
    productionFiles,
    sourceFiles: { raw: rawFileUrl },
  };
}

/**
 * Normalize Python / ecommerce / legacy JSON before writing to DB.
 * Always ensures sourceFiles.raw + productionFiles.svg.
 */
export function normalizeApprovedFiles(
  input: unknown,
  fallbacks?: { rawFileUrl?: string; processedSvgUrl?: string },
): BiometricApprovedFiles {
  const files = (input ?? {}) as LooseFiles;
  const productionIn = files.productionFiles ?? {};

  const svg =
    (typeof productionIn.svg === 'string' && productionIn.svg) ||
    fallbacks?.processedSvgUrl ||
    '';

  const audioOriginal =
    (typeof productionIn.audioOriginal === 'string' &&
      productionIn.audioOriginal) ||
    (typeof files.audioOriginal === 'string' && files.audioOriginal) ||
    undefined;

  const audioSegment =
    (typeof productionIn.audioSegment === 'string' &&
      productionIn.audioSegment) ||
    (typeof files.audioSegment === 'string' && files.audioSegment) ||
    undefined;

  const waveformPoints =
    typeof productionIn.waveformPoints === 'string'
      ? productionIn.waveformPoints
      : undefined;

  const raw =
    (typeof files.sourceFiles?.raw === 'string' && files.sourceFiles.raw) ||
    audioOriginal ||
    (typeof files.debugFiles?.inputPng === 'string' &&
      files.debugFiles.inputPng) ||
    fallbacks?.rawFileUrl ||
    '';

  const productionFiles: BiometricProductionFiles = { svg };
  if (waveformPoints) productionFiles.waveformPoints = waveformPoints;
  if (audioSegment) productionFiles.audioSegment = audioSegment;
  // SW: keep audioOriginal; mirror from source raw when segment exists but original missing.
  if (audioOriginal) {
    productionFiles.audioOriginal = audioOriginal;
  } else if (raw && audioSegment) {
    productionFiles.audioOriginal = raw;
  }

  const result: BiometricApprovedFiles = {
    productionFiles,
    sourceFiles: { raw: raw || productionFiles.audioOriginal || '' },
  };
  if (files.viewerFiles) {
    result.viewerFiles = files.viewerFiles;
  }
  return result;
}

export function resolveUrlsFromApprovedFiles(approvedFiles: unknown): {
  rawFileUrl: string;
  processedSvgUrl: string;
  audioOriginalUrl: string;
  audioSegmentUrl: string;
} {
  const normalized = normalizeApprovedFiles(approvedFiles);
  return {
    rawFileUrl: normalized.sourceFiles.raw,
    processedSvgUrl: normalized.productionFiles.svg,
    audioOriginalUrl:
      normalized.productionFiles.audioOriginal ||
      normalized.sourceFiles.raw ||
      '',
    audioSegmentUrl: normalized.productionFiles.audioSegment || '',
  };
}

export function asApprovedFilesJson(
  files: BiometricApprovedFiles,
): Record<string, unknown> {
  return files;
}
