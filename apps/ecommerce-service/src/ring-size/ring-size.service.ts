import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { randomUUID } from 'node:crypto';
import type { user_ring_sizes } from '@prisma/client';

export interface CreateRingSizeData {
  label?: string;
  handSide?: string;
  fingerType?: string;
  sizeSystem?: string;
  ringSize?: string;
  diameterMm?: number;
  circumferenceMm?: number;
  measurementMethod?: string;
  measurementSource?: string;
  guideStepResult?: Record<string, unknown>;
  imageUrl?: string;
  confidenceScore?: number;
  isDefault?: boolean;
  note?: string;
}

export interface UpdateRingSizeData extends Partial<CreateRingSizeData> {}

@Injectable()
export class RingSizeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<user_ring_sizes[]> {
    return this.prisma.user_ring_sizes.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async getById(id: string, userId: string): Promise<user_ring_sizes> {
    const record = await this.prisma.user_ring_sizes.findUnique({
      where: { id },
    });
    if (!record || record.user_id !== userId) {
      throw new NotFoundException(`Ring size record ${id} not found`);
    }
    return record;
  }

  async create(
    userId: string,
    data: CreateRingSizeData,
  ): Promise<user_ring_sizes> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.user_ring_sizes.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false },
        });
      }

      return tx.user_ring_sizes.create({
        data: {
          id: randomUUID(),
          user_id: userId,
          label: data.label ?? null,
          hand_side: data.handSide ?? null,
          finger_type: data.fingerType ?? null,
          size_system: data.sizeSystem ?? 'VN',
          ring_size: data.ringSize ?? null,
          diameter_mm: data.diameterMm ?? null,
          circumference_mm: data.circumferenceMm ?? null,
          measurement_method: data.measurementMethod ?? 'SELF',
          measurement_source: data.measurementSource ?? 'APP',
          guide_step_result: data.guideStepResult
            ? JSON.parse(JSON.stringify(data.guideStepResult))
            : null,
          image_url: data.imageUrl ?? null,
          confidence_score: data.confidenceScore ?? null,
          is_default: data.isDefault ?? false,
          note: data.note ?? null,
          measured_at: now,
          created_at: now,
          updated_at: now,
        },
      });
    });
  }

  async update(
    id: string,
    userId: string,
    data: UpdateRingSizeData,
  ): Promise<user_ring_sizes> {
    const record = await this.prisma.user_ring_sizes.findUnique({
      where: { id },
    });
    if (!record || record.user_id !== userId) {
      throw new NotFoundException(`Ring size record ${id} not found`);
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.user_ring_sizes.updateMany({
          where: { user_id: userId, is_default: true, NOT: { id } },
          data: { is_default: false },
        });
      }

      return tx.user_ring_sizes.update({
        where: { id },
        data: {
          ...(data.label !== undefined && { label: data.label }),
          ...(data.handSide !== undefined && { hand_side: data.handSide }),
          ...(data.fingerType !== undefined && {
            finger_type: data.fingerType,
          }),
          ...(data.sizeSystem !== undefined && {
            size_system: data.sizeSystem,
          }),
          ...(data.ringSize !== undefined && { ring_size: data.ringSize }),
          ...(data.diameterMm !== undefined && {
            diameter_mm: data.diameterMm,
          }),
          ...(data.circumferenceMm !== undefined && {
            circumference_mm: data.circumferenceMm,
          }),
          ...(data.measurementMethod !== undefined && {
            measurement_method: data.measurementMethod,
          }),
          ...(data.measurementSource !== undefined && {
            measurement_source: data.measurementSource,
          }),
          ...(data.guideStepResult !== undefined && {
            guide_step_result: data.guideStepResult
              ? JSON.parse(JSON.stringify(data.guideStepResult))
              : null,
          }),
          ...(data.imageUrl !== undefined && { image_url: data.imageUrl }),
          ...(data.confidenceScore !== undefined && {
            confidence_score: data.confidenceScore,
          }),
          ...(data.isDefault !== undefined && { is_default: data.isDefault }),
          ...(data.note !== undefined && { note: data.note }),
          updated_at: now,
        },
      });
    });
  }

  async delete(id: string, userId: string): Promise<{ success: boolean }> {
    const record = await this.prisma.user_ring_sizes.findUnique({
      where: { id },
    });
    if (!record || record.user_id !== userId) {
      throw new NotFoundException(`Ring size record ${id} not found`);
    }

    await this.prisma.user_ring_sizes.delete({ where: { id } });
    return { success: true };
  }

  async setDefault(id: string, userId: string): Promise<user_ring_sizes> {
    return this.update(id, userId, { isDefault: true });
  }
}
