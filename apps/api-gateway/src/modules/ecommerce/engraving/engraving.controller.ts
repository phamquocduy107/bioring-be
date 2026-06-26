import {
  Controller,
  Get,
  Patch,
  Post,
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
  CreateEngravingDto,
  EngravingResponse,
  EngravingVersionResponse,
  EngravingBioMetricResponse,
  QrMemoryResponse,
  CreateEngravingFullResponse,
  UpdateConfigResponse,
  GetMyEngravingsQueryDto,
  UpdateEngravingVersionConfigDto,
} from '@app/common';
import type { JwtPayload } from '@app/common';
import {
  ApiCreateEngravingDocs,
  ApiUpdateEngravingVersionConfigDocs,
  ApiResubmitEngravingVersionDocs,
  ApiGetMyEngravingsDocs,
  ApiGetEngravingDocs,
} from './engraving.swagger';

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
  }): Observable<UpdateConfigResponse>;
  resubmitEngravingVersion(data: {
    engravingVersionId: string;
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
  getEngraving(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
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
      }),
    );
  }

  @Post('versions/:versionId/resubmit')
  @ApiResubmitEngravingVersionDocs()
  resubmit(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
  ) {
    return this.call(() =>
      this.grpc!.resubmitEngravingVersion({
        engravingVersionId: versionId,
      }),
    );
  }
}
