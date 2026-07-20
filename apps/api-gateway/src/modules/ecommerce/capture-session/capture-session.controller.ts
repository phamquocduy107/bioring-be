import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import {
  CurrentUser,
  Permissions,
  Permission,
  CreateCaptureSessionDto,
  CompleteCaptureSessionDto,
  GetCaptureSessionsQueryDto,
} from '@app/common';
import type { JwtPayload } from '@app/common';

interface EcommerceGrpcService {
  createCaptureSession(data: {
    orderId: string;
    staffId: string;
    deviceId?: string;
  }): Observable<any>;
  completeCaptureSession(data: {
    id: string;
    qualityScore?: number;
    staffNote?: string;
  }): Observable<any>;
  getCaptureSessions(data: { orderId?: string }): Observable<any>;
  getCaptureSession(data: { id: string }): Observable<any>;
}

@Controller('api/v1/capture-sessions')
export class CaptureSessionController implements OnModuleInit {
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

  @Post()
  @Permissions(Permission.OrderWrite)
  async createSession(
    @Body() dto: CreateCaptureSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.createCaptureSession({
        orderId: dto.orderId,
        staffId: user.sub,
        deviceId: dto.deviceId,
      }),
    );
  }

  @Patch(':id/complete')
  @Permissions(Permission.OrderWrite)
  async completeSession(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteCaptureSessionDto,
  ) {
    return this.call(() =>
      this.grpc!.completeCaptureSession({
        id,
        qualityScore: dto.qualityScore,
        staffNote: dto.staffNote,
      }),
    );
  }

  @Get()
  @Permissions(Permission.OrderWrite)
  async getSessions(@Query() query: GetCaptureSessionsQueryDto) {
    return this.call(() =>
      this.grpc!.getCaptureSessions({ orderId: query.orderId }),
    );
  }

  @Get(':id')
  @Permissions(Permission.OrderWrite)
  async getSession(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.grpc!.getCaptureSession({ id }));
  }
}
