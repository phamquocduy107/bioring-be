import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { DeviceService } from './device.service';

@Controller()
export class DeviceController {
  constructor(private readonly service: DeviceService) {}

  @GrpcMethod('EcommerceService', 'ListDevices')
  async listDevices(data: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    try {
      return await this.service.listDevices({
        page: data.page ?? 1,
        limit: data.limit ?? 20,
        status: data.status,
        search: data.search,
      });
    } catch (e: any) {
      throw new RpcException(e);
    }
  }

  @GrpcMethod('EcommerceService', 'GetDevice')
  async getDevice(data: { id: string }) {
    try {
      return await this.service.getDevice(data.id);
    } catch (e: any) {
      throw new RpcException(e);
    }
  }

  @GrpcMethod('EcommerceService', 'CreateDevice')
  async createDevice(data: {
    device_name: string;
    mac_address: string;
    device_type: string;
  }) {
    try {
      return await this.service.createDevice(data);
    } catch (e: any) {
      throw new RpcException(e);
    }
  }

  @GrpcMethod('EcommerceService', 'UpdateDevice')
  async updateDevice(data: {
    id: string;
    device_name?: string;
    device_type?: string;
    status?: string;
    firmware_version?: string;
  }) {
    try {
      return await this.service.updateDevice(data);
    } catch (e: any) {
      throw new RpcException(e);
    }
  }

  @GrpcMethod('EcommerceService', 'DeleteDevice')
  async deleteDevice(data: { id: string }) {
    try {
      return await this.service.deleteDevice(data.id);
    } catch (e: any) {
      throw new RpcException(e);
    }
  }
}
