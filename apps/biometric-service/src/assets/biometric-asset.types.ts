import type {
  ApprovedFilesBundleDto,
  ReviewFilesBundleDto,
  ViewerFilesDto,
} from '../engine/personalization-engine.client';

export const READY_FOR_REVIEW = 'READY_FOR_REVIEW';
export const ASSET_APPROVED = 'ASSET_APPROVED';
export const PLACEMENT_CONFIRMED = 'PLACEMENT_CONFIRMED';
export const PROCESSING = 'PROCESSING';

export type PipelineAssetType = 'fingerprint' | 'soundwave';

export interface BiometricAssetDto {
  assetId: string;
  artifactId: string;
  status: string;
  reviewFiles?: ReviewFilesBundleDto;
  approvedFiles?: ApprovedFilesBundleDto;
  manifestUrl?: string;
  modelCode?: string;
  surface?: string;
  viewerFiles?: ViewerFilesDto;
  placement?: Record<string, unknown>;
  rawFileUrl?: string;
  assignedUserId?: string;
  engravingId?: string;
  /** @deprecated Prefer engravingId */
  orderItemId?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalNote?: string;
  placementConfirmedAt?: string;
  qualityScore?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function toPythonArtifactType(assetType: string): PipelineAssetType {
  return assetType === 'soundwave' ? 'soundwave' : 'fingerprint';
}
