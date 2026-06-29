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

  @ApiProperty()
  rawFileUrl!: string;

  @ApiProperty()
  processedSvgUrl!: string;

  @ApiProperty()
  extraData!: string;

  @ApiProperty()
  status!: string;
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

  @ApiProperty({ type: [EngravingBioMetricResponse] })
  biometrics!: EngravingBioMetricResponse[];

  @ApiPropertyOptional({ type: QrMemoryResponse })
  qrMemory?: QrMemoryResponse;

  @ApiPropertyOptional({ type: EngravingVersionResponse })
  currentVersion?: EngravingVersionResponse;
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
