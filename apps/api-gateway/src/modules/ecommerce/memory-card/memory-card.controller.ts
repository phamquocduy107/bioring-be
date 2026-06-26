import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  ParseUUIDPipe,
  Body,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import {
  Public,
  UpdateQrMemoryDto,
  ActivateQrMemoryDto,
  QrMemoryResponse,
} from '@app/common';
import {
  ApiUpdateQrMemoryDocs,
  ApiGetQrMemoryDocs,
  ApiActivateQrMemoryDocs,
} from './memory-card.swagger';

interface EcommerceGrpcService {
  updateQrMemory(data: {
    engravingId: string;
    cardTitle?: string;
    greetingMessage?: string;
    recipientEmail?: string;
    cardThemeId?: string;
    customImages?: string;
    biometricDisplaySettings?: string;
  }): Observable<{ qrMemory: QrMemoryResponse }>;
  getQrMemory(data: {
    engravingId: string;
  }): Observable<{ qrMemory: QrMemoryResponse }>;
  activateQrMemory(data: {
    qrCode: string;
    accessPin: string;
  }): Observable<{ qrMemory: QrMemoryResponse }>;
}

@Controller('api/v1/qr-memories')
export class MemoryCardController implements OnModuleInit {
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

  @Put(':engravingId')
  @ApiUpdateQrMemoryDocs()
  updateQrMemory(
    @Param('engravingId', new ParseUUIDPipe({ version: '4' }))
    engravingId: string,
    @Body() body: UpdateQrMemoryDto,
  ) {
    return this.call(() =>
      this.grpc!.updateQrMemory({
        engravingId,
        cardTitle: body.cardTitle,
        greetingMessage: body.greetingMessage,
        recipientEmail: body.recipientEmail,
        cardThemeId: body.cardThemeId,
        customImages: body.customImages,
        biometricDisplaySettings: body.biometricDisplaySettings,
      }),
    );
  }

  @Get(':engravingId')
  @ApiGetQrMemoryDocs()
  getQrMemory(
    @Param('engravingId', new ParseUUIDPipe({ version: '4' }))
    engravingId: string,
  ) {
    return this.call(() => this.grpc!.getQrMemory({ engravingId }));
  }

  @Post('activate')
  @Public()
  @ApiActivateQrMemoryDocs()
  activate(@Body() body: ActivateQrMemoryDto) {
    return this.call(() =>
      this.grpc!.activateQrMemory({
        qrCode: body.qrCode,
        accessPin: body.accessPin,
      }),
    );
  }
}
