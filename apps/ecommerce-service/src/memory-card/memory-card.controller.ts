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
}
