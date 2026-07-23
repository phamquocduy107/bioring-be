import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Optional,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import {
  CurrentUser,
  CreateEngravingDto,
  EngravingResponse,
  EngravingVersionResponse,
  EngravingBioMetricResponse,
  QrMemoryResponse,
  CreateEngravingFullResponse,
  UpdateConfigResponse,
  GetMyEngravingsQueryDto,
  UpdateEngravingVersionConfigDto,
  AttachBiometricDto,
  BIOMETRIC_MAX_UPLOAD_BYTES,
  Permission,
  Permissions,
  SkipTimeout,
} from '@app/common';
import type { JwtPayload } from '@app/common';
import {
  ApiCreateEngravingDocs,
  ApiUpdateEngravingVersionConfigDocs,
  ApiGetMyEngravingsDocs,
  ApiGetEngravingDocs,
  ApiAttachBiometricDocs,
  ApiAttachBiometricsBulkDocs,
  ApiCancelEngravingDocs,
} from './engraving.swagger';

interface UploadedBiometricFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface EcommerceGrpcService {
  createEngraving(data: {
    userId: string;
    productId?: string;
  }): Observable<CreateEngravingFullResponse>;
  updateEngravingVersionConfig(data: {
    engravingVersionId: string;
    customizationConfig?: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    ringSize?: string;
    ringStyle?: string;
    ringShape?: string;
    previewImageUrl?: string;
    model3dUrl?: string;
    productionFileUrl?: string;
    selectedBiometrics?: string;
  }): Observable<UpdateConfigResponse>;
  getMyEngravings(data: {
    userId: string;
    page: number;
    limit: number;
    status?: string;
    orderId?: string;
  }): Observable<{
    engravings: EngravingResponse[];
    total: number;
    page: number;
    limit: number;
  }>;
  getEngraving(data: {
    id: string;
  }): Observable<{ engraving: EngravingResponse }>;
  attachBiometric(data: {
    engravingId: string;
    biometricType: string;
    fileContent: Buffer;
    filename: string;
    contentType: string;
    extraData?: string;
  }): Observable<{ biometric: EngravingBioMetricResponse }>;
  attachBiometricsBulk(data: {
    engravingId: string;
    biometrics: Array<{
      biometricType: string;
      fileContent: Buffer;
      filename: string;
      contentType: string;
      extraData?: string;
    }>;
  }): Observable<{ count: number; biometrics: EngravingBioMetricResponse[] }>;
  cancelEngraving(data: {
    id: string;
    user_id: string;
  }): Observable<{ success: boolean }>;
}

@Controller('api/v1/engravings')
export class EngravingController implements OnModuleInit {
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
  @ApiCreateEngravingDocs()
  createEngraving(
    @Body() body: CreateEngravingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.createEngraving({
        userId: user.sub,
        productId: body.productId,
      }),
    );
  }

  @Get()
  @ApiGetMyEngravingsDocs()
  getMyEngravings(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetMyEngravingsQueryDto,
  ) {
    return this.call(() =>
      this.grpc!.getMyEngravings({
        userId: user.sub,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        status: query.status,
        orderId: query.orderId,
      }),
    );
  }

  @Get(':id')
  @ApiGetEngravingDocs()
  getEngraving(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.call(() => this.grpc!.getEngraving({ id }));
  }

  @Patch('versions/:versionId/config')
  @ApiUpdateEngravingVersionConfigDocs()
  updateConfig(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Body() body: UpdateEngravingVersionConfigDto,
  ) {
    return this.call(() =>
      this.grpc!.updateEngravingVersionConfig({
        engravingVersionId: versionId,
        customizationConfig: body.customizationConfig,
        selectedMaterialId: body.selectedMaterialId,
        selectedGemstoneId: body.selectedGemstoneId,
        ringSize: body.ringSize,
        ringStyle: body.ringStyle,
        ringShape: body.ringShape,
        previewImageUrl: body.previewImageUrl,
        model3dUrl: body.model3dUrl,
        productionFileUrl: body.productionFileUrl,
        selectedBiometrics: body.selectedBiometrics
          ? JSON.stringify(body.selectedBiometrics)
          : undefined,
      }),
    );
  }

  @Post(':id/biometrics')
  @SkipTimeout()
  @Permissions(Permission.OrderWrite)
  @ApiAttachBiometricDocs()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: BIOMETRIC_MAX_UPLOAD_BYTES },
    }),
  )
  attachBiometric(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: UploadedBiometricFile | undefined,
    @Body() body: AttachBiometricDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'file is required (multipart field "file")',
      );
    }
    return this.call(() =>
      this.grpc!.attachBiometric({
        engravingId: id,
        biometricType: body.biometricType,
        fileContent: file.buffer,
        filename: file.originalname || 'upload.bin',
        contentType: file.mimetype || 'application/octet-stream',
        extraData: body.extraData,
      }),
    );
  }

  @Post(':id/biometrics/bulk')
  @Permissions(Permission.OrderWrite)
  @ApiAttachBiometricsBulkDocs()
  attachBiometricsBulk() {
    throw new BadRequestException(
      'Bulk attach is deprecated. Upload each biometric via multipart POST /api/v1/engravings/:id/biometrics (field "file").',
    );
  }

  @Patch(':id/cancel')
  @ApiCancelEngravingDocs()
  cancelEngraving(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.cancelEngraving({ id, user_id: user.sub }),
    );
  }
}
