import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  RingSizeService,
  CreateRingSizeData,
  UpdateRingSizeData,
} from './ring-size.service';

@Controller()
export class RingSizeController {
  constructor(private readonly ringSizeService: RingSizeService) {}

  private mapRingSize(record: any) {
    if (!record) return null;
    return {
      id: record.id,
      userId: record.user_id,
      label: record.label ?? '',
      handSide: record.hand_side ?? '',
      fingerType: record.finger_type ?? '',
      sizeSystem: record.size_system ?? '',
      ringSize: record.ring_size ?? '',
      diameterMm: record.diameter_mm ? Number(record.diameter_mm) : 0,
      circumferenceMm: record.circumference_mm ? Number(record.circumference_mm) : 0,
      measurementMethod: record.measurement_method ?? '',
      measurementSource: record.measurement_source ?? '',
      guideStepResult: record.guide_step_result
        ? typeof record.guide_step_result === 'string'
          ? record.guide_step_result
          : JSON.stringify(record.guide_step_result)
        : '',
      imageUrl: record.image_url ?? '',
      confidenceScore: record.confidence_score ? Number(record.confidence_score) : 0,
      isDefault: record.is_default ?? false,
      note: record.note ?? '',
      measuredAt: record.measured_at ? record.measured_at.toISOString() : '',
      createdAt: record.created_at ? record.created_at.toISOString() : '',
      updatedAt: record.updated_at ? record.updated_at.toISOString() : '',
    };
  }

  @GrpcMethod('EcommerceService', 'ListRingSizes')
  async listRingSizes(data: { userId: string }) {
    const ringSizes = await this.ringSizeService.list(data.userId);
    return { ringSizes: ringSizes.map((r) => this.mapRingSize(r)) };
  }

  @GrpcMethod('EcommerceService', 'GetRingSize')
  async getRingSize(data: { id: string; userId: string }) {
    const ringSize = await this.ringSizeService.getById(data.id, data.userId);
    return { ringSize: this.mapRingSize(ringSize) };
  }

  @GrpcMethod('EcommerceService', 'CreateRingSize')
  async createRingSize(data: { userId: string } & CreateRingSizeData & { guideStepResult?: string }) {
    const { userId, guideStepResult, ...payload } = data;
    let parsedGuide: any = undefined;
    if (guideStepResult && guideStepResult.trim()) {
      try {
        parsedGuide = JSON.parse(guideStepResult);
      } catch {}
    }
    const ringSize = await this.ringSizeService.create(userId, {
      ...payload,
      guideStepResult: parsedGuide,
    });
    return { ringSize: this.mapRingSize(ringSize) };
  }

  @GrpcMethod('EcommerceService', 'UpdateRingSize')
  async updateRingSize(
    data: { id: string; userId: string } & UpdateRingSizeData & { guideStepResult?: string },
  ) {
    const { id, userId, guideStepResult, ...payload } = data;
    let parsedGuide: any = undefined;
    if (guideStepResult && guideStepResult.trim()) {
      try {
        parsedGuide = JSON.parse(guideStepResult);
      } catch {}
    }
    const ringSize = await this.ringSizeService.update(id, userId, {
      ...payload,
      guideStepResult: parsedGuide,
    });
    return { ringSize: this.mapRingSize(ringSize) };
  }

  @GrpcMethod('EcommerceService', 'DeleteRingSize')
  async deleteRingSize(data: { id: string; userId: string }) {
    return this.ringSizeService.delete(data.id, data.userId);
  }

  @GrpcMethod('EcommerceService', 'SetDefaultRingSize')
  async setDefaultRingSize(data: { id: string; userId: string }) {
    const ringSize = await this.ringSizeService.setDefault(
      data.id,
      data.userId,
    );
    return { ringSize: this.mapRingSize(ringSize) };
  }
}
