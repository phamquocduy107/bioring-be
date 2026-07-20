import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import {
  Permissions,
  Permission,
  ListDevicesQueryDto,
  CreateDeviceBodyDto,
  UpdateDeviceBodyDto,
} from '@app/common';
import {
  ApiListDevicesDocs,
  ApiGetDeviceDocs,
  ApiCreateDeviceDocs,
  ApiUpdateDeviceDocs,
  ApiDeleteDeviceDocs,
} from './device.swagger';

interface EcommerceGrpcService {
  listDevices(data: Record<string, unknown>): Observable<unknown>;
  getDevice(data: { id: string }): Observable<unknown>;
  createDevice(data: Record<string, unknown>): Observable<unknown>;
  updateDevice(data: Record<string, unknown>): Observable<unknown>;
  deleteDevice(data: { id: string }): Observable<{ success: boolean }>;
}

@Controller('api/v1/devices')
export class DeviceController implements OnModuleInit {
  private grpc?: EcommerceGrpcService;

  constructor(
    @Optional()
    @Inject('ECOMMERCE_SERVICE')
    private readonly client?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpc =
      this.client?.getService<EcommerceGrpcService>('EcommerceService');
  }

  private async call<T>(fn: () => Observable<T>): Promise<T> {
    if (!this.grpc)
      throw new Error('ECOMMERCE_SERVICE gRPC client not initialized');
    return lastValueFrom(fn());
  }

  @Get()
  @Permissions(Permission.DeviceRead)
  @ApiListDevicesDocs()
  async listDevices(@Query() query: ListDevicesQueryDto) {
    return this.call(() =>
      this.grpc!.listDevices({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        status: query.status ?? '',
        search: query.search ?? '',
      }),
    );
  }

  @Get(':id')
  @Permissions(Permission.DeviceRead)
  @ApiGetDeviceDocs()
  async getDevice(@Param('id') id: string) {
    return this.call(() => this.grpc!.getDevice({ id }));
  }

  @Post()
  @Permissions(Permission.DeviceWrite)
  @ApiCreateDeviceDocs()
  async createDevice(@Body() body: CreateDeviceBodyDto) {
    return this.call(() =>
      this.grpc!.createDevice({
        device_name: body.device_name,
        mac_address: body.mac_address,
        device_type: body.device_type,
      }),
    );
  }

  @Patch(':id')
  @Permissions(Permission.DeviceWrite)
  @ApiUpdateDeviceDocs()
  async updateDevice(@Param('id') id: string, @Body() body: UpdateDeviceBodyDto) {
    return this.call(() =>
      this.grpc!.updateDevice({ id, ...body }),
    );
  }

  @Delete(':id')
  @Permissions(Permission.DeviceWrite)
  @ApiDeleteDeviceDocs()
  async deleteDevice(@Param('id') id: string) {
    return this.call(() => this.grpc!.deleteDevice({ id }));
  }
}
