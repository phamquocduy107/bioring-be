import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { createHash } from 'node:crypto';

type QrMemoryRecord = Prisma.qr_memoriesGetPayload<{
  include: { card_themes: true };
}>;

@Injectable()
export class MemoryCardService {
  constructor(private readonly prisma: PrismaService) {}

  async updateQrMemory(
    engravingId: string,
    data: {
      cardTitle?: string;
      greetingMessage?: string;
      recipientEmail?: string;
      cardThemeId?: string;
      customImages?: string;
      biometricDisplaySettings?: string;
    },
  ) {
    const qrMemory = await this.prisma.qr_memories.findUnique({
      where: { engraving_id: engravingId },
    });
    if (!qrMemory)
      throw new NotFoundException('QR memory not found for this engraving');

    const updateData: Record<string, unknown> = {};
    if (data.cardTitle !== undefined) updateData.card_title = data.cardTitle;
    if (data.greetingMessage !== undefined)
      updateData.greeting_message = data.greetingMessage;
    if (data.cardThemeId !== undefined)
      updateData.theme_id = data.cardThemeId;
    if (data.customImages !== undefined)
      updateData.custom_images = JSON.parse(data.customImages);
    if (data.biometricDisplaySettings !== undefined)
      updateData.biometric_display_settings = JSON.parse(data.biometricDisplaySettings);

    const updated = await this.prisma.qr_memories.update({
      where: { engraving_id: engravingId },
      data: updateData,
      include: { card_themes: true },
    });

    return this.mapQrMemory(updated);
  }

  async getQrMemory(engravingId: string) {
    const qrMemory = await this.prisma.qr_memories.findUnique({
      where: { engraving_id: engravingId },
      include: { card_themes: true },
    });
    if (!qrMemory)
      throw new NotFoundException('QR memory not found for this engraving');
    return this.mapQrMemory(qrMemory);
  }

  async activateQrMemory(qrCode: string, accessPin: string) {
    const qrMemory = await this.prisma.qr_memories.findUnique({
      where: { qr_code: qrCode },
    });
    if (!qrMemory) throw new NotFoundException('QR memory not found');

    const hash = createHash('sha256').update(accessPin).digest('hex');
    if (qrMemory.access_pin_hash !== hash) {
      throw new NotFoundException('Invalid access PIN');
    }

    const updated = await this.prisma.qr_memories.update({
      where: { qr_code: qrCode },
      data: { is_locked: false, activated_at: new Date() },
      include: { card_themes: true },
    });

    return this.mapQrMemory(updated);
  }

  private mapQrMemory(qr: QrMemoryRecord) {
    return {
      id: qr.id,
      engravingId: qr.engraving_id,
      qrCode: qr.qr_code,
      cardTitle: qr.card_title ?? '',
      greetingMessage: qr.greeting_message ?? '',
      recipientEmail: '',
      customImages: qr.custom_images
        ? JSON.stringify(qr.custom_images)
        : '',
      biometricDisplaySettings: qr.biometric_display_settings
        ? JSON.stringify(qr.biometric_display_settings)
        : '',
      accessPinHash: qr.access_pin_hash ?? '',
      isLocked: qr.is_locked ?? false,
      cardTheme: qr.card_themes
        ? {
            id: qr.card_themes.id,
            themeCode: qr.card_themes.theme_code,
            name: qr.card_themes.name,
            defaultBgUrl: qr.card_themes.default_bg_url ?? '',
            styleConfig: qr.card_themes.style_config
              ? JSON.stringify(qr.card_themes.style_config)
              : '',
            isActive: qr.card_themes.is_active ?? false,
            createdAt: qr.card_themes.created_at?.toISOString() ?? '',
          }
        : null,
      createdAt: qr.created_at?.toISOString() ?? '',
      updatedAt: qr.updated_at?.toISOString() ?? '',
    };
  }
}
