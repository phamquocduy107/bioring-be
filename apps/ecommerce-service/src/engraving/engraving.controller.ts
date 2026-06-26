import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { EngravingService } from './engraving.service';

@Controller()
export class EngravingController {
  constructor(private readonly engravingService: EngravingService) {}

  @GrpcMethod('EcommerceService', 'CreateEngraving')
  async createEngraving(data: { userId: string; productId?: string }) {
    return this.engravingService.createEngraving(data.userId, data.productId);
  }

  @GrpcMethod('EcommerceService', 'UpdateEngravingVersionConfig')
  async updateVersionConfig(data: {
    engravingVersionId: string;
    customizationConfig?: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    ringSize?: string;
    ringStyle?: string;
    ringShape?: string;
    previewImageUrl?: string;
    model3dUrl?: string;
    productionFileUrl?: string;
  }) {
    let audioUrl: string | undefined;
    if (data.customizationConfig) {
      try {
        const config = JSON.parse(data.customizationConfig) as Record<string, unknown>;
        const positions = config.engravingPositions as Record<string, unknown> | undefined;
        audioUrl = (positions?.sw as Record<string, unknown> | undefined)?.['audioUrl'] as string | undefined;
      } catch {}
    }

    return this.engravingService.updateVersionConfig(
      data.engravingVersionId,
      {
        customizationConfig: data.customizationConfig,
        selectedMaterialId: data.selectedMaterialId,
        selectedGemstoneId: data.selectedGemstoneId,
        ringSize: data.ringSize,
        ringStyle: data.ringStyle,
        ringShape: data.ringShape,
        previewImageUrl: data.previewImageUrl,
        model3dUrl: data.model3dUrl,
        productionFileUrl: data.productionFileUrl,
      },
      audioUrl,
    );
  }

  @GrpcMethod('EcommerceService', 'ResubmitEngravingVersion')
  async resubmitVersion(data: { engravingVersionId: string }) {
    return this.engravingService.resubmitVersion(data.engravingVersionId);
  }

  @GrpcMethod('EcommerceService', 'GetMyEngravings')
  async getMyEngravings(data: {
    userId: string;
    page: number;
    limit: number;
    status?: string;
    orderId?: string;
  }) {
    return this.engravingService.getMyEngravings(
      data.userId,
      data.page,
      data.limit,
      data.status,
      data.orderId,
    );
  }

  @GrpcMethod('EcommerceService', 'GetEngraving')
  async getEngraving(data: { id: string }) {
    return this.engravingService.getEngraving(data.id);
  }
}
