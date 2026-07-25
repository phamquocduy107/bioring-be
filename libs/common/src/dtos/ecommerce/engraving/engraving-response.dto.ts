import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QrMemoryResponse } from '../qr-memory/qr-memory-response.dto';
import { MaterialResponse, GemstoneResponse } from '../catalog';

export class EngravingVersionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  engravingId!: string;

  @ApiProperty()
  versionNumber!: number;

  @ApiProperty()
  selectedMaterialId!: string;

  @ApiProperty()
  selectedGemstoneId!: string;

  @ApiProperty()
  ringSize!: string;

  @ApiProperty()
  ringStyle!: string;

  @ApiProperty()
  ringShape!: string;

  @ApiProperty()
  customizationConfig!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  managerId!: string;

  @ApiProperty()
  managerNote!: string;

  @ApiProperty()
  reviewedAt!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ type: MaterialResponse })
  selectedMaterial?: MaterialResponse;

  @ApiPropertyOptional({ type: GemstoneResponse })
  selectedGemstone?: GemstoneResponse;
}

export class EngravingBioMetricResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  engravingId!: string;

  @ApiProperty()
  biometricType!: string;

  @ApiProperty()
  requiredChannel!: string;

  @ApiProperty({ required: false })
  biometricAssetId?: string;

  @ApiProperty({
    description:
      'Resolved from biometric_assets.approved_files.sourceFiles.raw',
  })
  rawFileUrl!: string;

  @ApiProperty({
    description:
      'Resolved from biometric_assets.approved_files.productionFiles.svg',
  })
  processedSvgUrl!: string;

  @ApiProperty()
  extraData!: string;

  @ApiProperty()
  status!: string;
}

class MaterialBrief {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() purity!: string;
  @ApiProperty() color!: string;
  @ApiProperty() currentPricePerGram!: number;
  @ApiPropertyOptional() renderConfig?: string;
}

class GemstoneBrief {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() carat!: number;
  @ApiProperty() cut!: string;
  @ApiProperty() color!: string;
  @ApiProperty() clarity!: string;
  @ApiProperty() certificationCode!: string;
  @ApiProperty() price!: number;
  @ApiProperty() isAvailable!: boolean;
  @ApiPropertyOptional() renderConfig?: string;
}

export class BiometricAssetBrief {
  @ApiProperty() id!: string;
  @ApiProperty() assetType!: string;
  @ApiProperty() status!: string;
  @ApiProperty() artifactId!: string;
  @ApiProperty() rawFileUrl!: string;
  @ApiProperty() processedSvgUrl!: string;
  @ApiProperty() createdAt!: string;
}

export class ProductBriefResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() basePrice!: number;
  @ApiProperty() thumbnailUrl!: string;
  @ApiProperty() model3dUrl!: string;
  @ApiPropertyOptional({ type: MaterialBrief })
  baseMaterial?: MaterialBrief;
  @ApiProperty({ type: [MaterialBrief] })
  availableMaterials!: MaterialBrief[];
  @ApiProperty({ type: [GemstoneBrief] })
  availableGemstones!: GemstoneBrief[];
}

export class EngravingResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  uniqueProductId!: string;

  @ApiProperty()
  approvedVersionId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [EngravingVersionResponse] })
  versions!: EngravingVersionResponse[];

  @ApiPropertyOptional({ type: QrMemoryResponse })
  qrMemory?: QrMemoryResponse;

  @ApiPropertyOptional({ type: EngravingVersionResponse })
  currentVersion?: EngravingVersionResponse;

  @ApiPropertyOptional({ type: ProductBriefResponse })
  product?: ProductBriefResponse;

  @ApiProperty({ type: [BiometricAssetBrief] })
  biometricAssets!: BiometricAssetBrief[];
}

export class GetEngravingResponse {
  @ApiProperty({ type: EngravingResponse })
  engraving!: EngravingResponse;
}

export class GetMyEngravingsResponse {
  @ApiProperty({ type: [EngravingResponse] })
  engravings!: EngravingResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class CreateEngravingFullResponse {
  @ApiProperty({ type: EngravingResponse })
  engraving!: EngravingResponse;

  @ApiProperty({ type: EngravingVersionResponse })
  engravingVersion!: EngravingVersionResponse;

  @ApiProperty()
  qrCode!: string;
}

export class UpdateConfigResponse {
  @ApiProperty({ type: EngravingVersionResponse })
  version!: EngravingVersionResponse;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  orderStatus!: string;
}
