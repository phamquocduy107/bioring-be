import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  ParseUUIDPipe,
  Body,
  Req,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import type { Request } from 'express';
import {
  Public,
  CurrentUser,
  Permissions,
  Permission,
  CreateDesignDraftDto,
  UpdateDesignDraftDto,
} from '@app/common';
import type { JwtPayload } from '@app/common';
import {
  ApiCreateDesignDraftDocs,
  ApiGetDesignDraftByCodeDocs,
  ApiGetMyDraftsDocs,
  ApiUpdateDesignDraftDocs,
  ApiClaimDesignDraftDocs,
} from './design.swagger';

interface MaterialResponse {
  id: string;
  name: string;
  purity: string;
  color: string;
  currentPricePerGram: number;
}

interface GemstoneResponse {
  id: string;
  type: string;
  carat: number;
  cut: string;
  color: string;
  clarity: string;
  certificationCode: string;
  price: number;
  isAvailable: boolean;
}

interface ProductResponse {
  id: string;
  name: string;
  description: string;
  baseMaterialId: string;
  basePrice: number;
  thumbnailUrl: string;
  model3dUrl: string;
  availableMaterials: MaterialResponse[];
  availableGemstones: GemstoneResponse[];
}

interface DesignDraftResponse {
  id: string;
  userId: string;
  productId: string;
  designCode: string;
  designSource: string;
  ringStyle: string;
  ringShape: string;
  ringSize: string;
  selectedMaterialId: string;
  selectedGemstoneId: string;
  customizationConfig: string;
  estimatedPrice: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  product: ProductResponse | null;
  selectedMaterial: MaterialResponse | null;
  selectedGemstone: GemstoneResponse | null;
}

interface EcommerceGrpcService {
  createDesignDraft(
    data: CreateDesignDraftDto & { guestSessionId: string },
  ): Observable<{ draft: DesignDraftResponse; designCode: string }>;
  getDesignDraftByCode(data: {
    designCode: string;
  }): Observable<{ draft: DesignDraftResponse }>;
  getMyDrafts(data: {
    guestSessionId: string;
  }): Observable<{ drafts: DesignDraftResponse[] }>;
  updateDesignDraft(
    data: UpdateDesignDraftDto & { id: string; guestSessionId: string },
  ): Observable<{ draft: DesignDraftResponse }>;
  claimDesignDraft(data: {
    designCode: string;
    userId: string;
  }): Observable<{ draft: DesignDraftResponse }>;
}

@Controller('api/v1/design')
export class DesignController implements OnModuleInit {
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

  @Post('drafts')
  @Public()
  @ApiCreateDesignDraftDocs()
  createDesignDraft(@Body() body: CreateDesignDraftDto, @Req() req: Request) {
    const guestSessionId =
      (req.cookies as Record<string, string> | undefined)?.guest_session_id ??
      '';
    return this.call(() =>
      this.grpc!.createDesignDraft({ ...body, guestSessionId }),
    );
  }

  @Get('drafts/by-code/:code')
  @Public()
  @ApiGetDesignDraftByCodeDocs()
  getDesignDraftByCode(@Param('code') code: string) {
    return this.call(() =>
      this.grpc!.getDesignDraftByCode({ designCode: code }),
    );
  }

  @Get('drafts')
  @Public()
  @ApiGetMyDraftsDocs()
  async getMyDrafts(@Req() req: Request) {
    const guestSessionId =
      (req.cookies as Record<string, string> | undefined)?.guest_session_id ??
      '';
    const result = await this.call(() =>
      this.grpc!.getMyDrafts({ guestSessionId }),
    );
    return { drafts: result?.drafts ?? [] };
  }

  @Put('drafts/:id')
  @Public()
  @ApiUpdateDesignDraftDocs()
  updateDesignDraft(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateDesignDraftDto,
    @Req() req: Request,
  ) {
    const guestSessionId =
      (req.cookies as Record<string, string> | undefined)?.guest_session_id ??
      '';
    return this.call(() =>
      this.grpc!.updateDesignDraft({ ...body, id, guestSessionId }),
    );
  }

  @Post('drafts/claim')
  @Permissions(Permission.DesignWrite)
  @ApiClaimDesignDraftDocs()
  claimDesignDraft(
    @Body() body: { designCode: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.claimDesignDraft({
        designCode: body.designCode,
        userId: user.sub,
      }),
    );
  }
}
