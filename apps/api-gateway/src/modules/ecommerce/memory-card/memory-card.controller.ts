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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';
import {
  Public,
  CurrentUser,
  UpdateQrMemoryDto,
  ActivateQrMemoryDto,
  QrMemoryResponse,
  QrMemoryUpdateResponse,
  QrMemoryActivateResponse,
  QrMemoryListResponse,
  QrMemoryUploadPhotoResponse,
  PaginationDto,
} from '@app/common';
import { MinioService } from '@app/minio';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { JwtPayload } from '@app/common';
import {
  ApiUpdateQrMemoryDocs,
  ApiGetQrMemoryDocs,
  ApiActivateQrMemoryDocs,
  ApiListQrMemoriesDocs,
  ApiGetQrMemoryByCodeDocs,
  ApiUploadPhotoDocs,
} from './memory-card.swagger';

interface UploadedPhotoFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

interface EcommerceGrpcService {
  updateQrMemory(data: {
    engravingId: string;
    cardTitle?: string;
    greetingMessage?: string;
    recipientEmail?: string;
    cardThemeId?: string;
    customImages?: string;
    biometricDisplaySettings?: string;
    accessPin?: string;
  }): Observable<{ qrMemory: QrMemoryResponse }>;
  getQrMemory(data: {
    engravingId: string;
  }): Observable<{ qrMemory: QrMemoryResponse }>;
  activateQrMemory(data: {
    qrCode: string;
    accessPin: string;
  }): Observable<{ qrMemory: QrMemoryResponse }>;
  listQrMemories(data: {
    userId: string;
    page: number;
    limit: number;
    hasTheme?: boolean;
  }): Observable<QrMemoryListResponse>;
  getQrMemoryByCode(data: {
    qrCode: string;
  }): Observable<{ qrMemory: QrMemoryResponse }>;
}

@ApiBearerAuth('access-token')
@Controller('api/v1/qr-memories')
export class MemoryCardController implements OnModuleInit {
  private grpc?: EcommerceGrpcService;

  constructor(
    @Inject('ECOMMERCE_SERVICE')
    private readonly client: ClientGrpc,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
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

  @Get('code/:qrCode')
  @Public()
  @ApiGetQrMemoryByCodeDocs()
  getQrMemoryByCode(@Param('qrCode') qrCode: string) {
    return this.call(() => this.grpc!.getQrMemoryByCode({ qrCode }));
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
        accessPin: body.accessPin,
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

  @Get()
  @ApiListQrMemoriesDocs()
  listQrMemories(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto,
    @Query('hasTheme') hasTheme?: string,
  ) {
    return this.call(() =>
      this.grpc!.listQrMemories({
        userId: user.sub,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        ...(hasTheme !== undefined && { hasTheme: hasTheme === 'true' }),
      }),
    );
  }

  @Post('upload-photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiUploadPhotoDocs()
  async uploadPhoto(
    @UploadedFile() file: UploadedPhotoFile,
  ) {
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const key = `qr-photos/${randomUUID()}.${ext}`;
    await this.minioService!.uploadObject(key, file.buffer, file.mimetype);
    const endpoint = this.configService!.get<string>('MINIO_PUBLIC_ENDPOINT', 'http://localhost:9000');
    const bucket = this.minioService!.getDefaultBucket();
    return { url: `${endpoint}/${bucket}/${key}` };
  }
}
