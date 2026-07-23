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

  @GrpcMethod('EcommerceService', 'ListRingSizes')
  async listRingSizes(data: { userId: string }) {
    const ringSizes = await this.ringSizeService.list(data.userId);
    return { ringSizes };
  }

  @GrpcMethod('EcommerceService', 'GetRingSize')
  async getRingSize(data: { id: string; userId: string }) {
    const ringSize = await this.ringSizeService.getById(data.id, data.userId);
    return { ringSize };
  }

  @GrpcMethod('EcommerceService', 'CreateRingSize')
  async createRingSize(data: { userId: string } & CreateRingSizeData) {
    const { userId, ...payload } = data;
    const ringSize = await this.ringSizeService.create(userId, payload);
    return { ringSize };
  }

  @GrpcMethod('EcommerceService', 'UpdateRingSize')
  async updateRingSize(
    data: { id: string; userId: string } & UpdateRingSizeData,
  ) {
    const { id, userId, ...payload } = data;
    const ringSize = await this.ringSizeService.update(id, userId, payload);
    return { ringSize };
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
    return { ringSize };
  }
}
