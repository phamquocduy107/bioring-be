import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { MemoryCardService } from './memory-card.service';

@Controller()
export class MemoryCardController {
  constructor(private readonly memoryCardService: MemoryCardService) {}

  @GrpcMethod('EcommerceService', 'UpdateQrMemory')
  async updateQrMemory(data: {
    engravingId: string;
    cardTitle?: string;
    greetingMessage?: string;
    recipientEmail?: string;
    cardThemeId?: string;
    customImages?: string;
    biometricDisplaySettings?: string;
    accessPin?: string;
  }) {
    const qrMemory = await this.memoryCardService.updateQrMemory(
      data.engravingId,
      {
        cardTitle: data.cardTitle,
        greetingMessage: data.greetingMessage,
        recipientEmail: data.recipientEmail,
        cardThemeId: data.cardThemeId,
        customImages: data.customImages,
        biometricDisplaySettings: data.biometricDisplaySettings,
        accessPin: data.accessPin,
      },
    );
    return { qrMemory };
  }

  @GrpcMethod('EcommerceService', 'GetQrMemory')
  async getQrMemory(data: { engravingId: string }) {
    const qrMemory = await this.memoryCardService.getQrMemory(data.engravingId);
    return { qrMemory };
  }

  @GrpcMethod('EcommerceService', 'ActivateQrMemory')
  async activateQrMemory(data: { qrCode: string; accessPin: string }) {
    const qrMemory = await this.memoryCardService.activateQrMemory(
      data.qrCode,
      data.accessPin,
    );
    return { qrMemory };
  }

  @GrpcMethod('EcommerceService', 'ListQrMemories')
  async listQrMemories(data: { userId: string; page: number; limit: number }) {
    return this.memoryCardService.listQrMemories(
      data.userId,
      data.page,
      data.limit,
    );
  }

  @GrpcMethod('EcommerceService', 'GetQrMemoryByCode')
  async getQrMemoryByCode(data: { qrCode: string }) {
    const qrMemory = await this.memoryCardService.getQrMemoryByCode(
      data.qrCode,
    );
    return { qrMemory };
  }
}
