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
  Public,
  CurrentUser,
  Permissions,
  Permission,
  CreateWarrantyClaimDto,
  CreateWarrantyClaimByLookupDto,
  ReviewWarrantyClaimDto,
  ReceiveServiceTicketDto,
  CompleteServiceTicketDto,
} from '@app/common';
import type { JwtPayload } from '@app/common';

interface EcommerceGrpcService {
  createWarrantyClaim(data: Record<string, unknown>): Observable<unknown>;
  createWarrantyClaimByLookup(data: Record<string, unknown>): Observable<unknown>;
  getWarrantyClaim(data: { id: string }): Observable<unknown>;
  getMyWarrantyClaims(data: {
    userId: string;
    page?: number;
    limit?: number;
    viewAll?: boolean;
  }): Observable<unknown>;
  reviewWarrantyClaim(data: Record<string, unknown>): Observable<unknown>;
  confirmWarrantyClaim(data: { id: string; userId: string }): Observable<unknown>;
  initiateClaimPayment(data: Record<string, unknown>): Observable<unknown>;
  receiveServiceTicket(data: Record<string, unknown>): Observable<unknown>;
  completeServiceTicket(data: Record<string, unknown>): Observable<unknown>;
  returnWarrantyClaim(data: { id: string; staffId: string }): Observable<unknown>;
}

@Controller('api/v1/warranty-claims')
export class WarrantyController implements OnModuleInit {
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
  async createClaim(
    @Body() dto: CreateWarrantyClaimDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.createWarrantyClaim({
        warrantyId: dto.warrantyId,
        orderId: dto.orderId,
        serviceType: dto.serviceType,
        issueDescription: dto.issueDescription,
        proofImages: dto.proofImages ?? [],
        proofVideos: dto.proofVideos ?? [],
        userId: user.sub,
      }),
    );
  }

  @Post('lookup')
  @Public()
  async createClaimByLookup(@Body() dto: CreateWarrantyClaimByLookupDto) {
    return this.call(() =>
      this.grpc!.createWarrantyClaimByLookup({
        orderCode: dto.orderCode,
        serviceType: dto.serviceType,
        issueDescription: dto.issueDescription,
        proofImages: dto.proofImages ?? [],
        proofVideos: dto.proofVideos ?? [],
      }),
    );
  }

  @Get()
  async getMyClaims(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('view') view: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const isAdmin = user.role?.some(r => ['ADMIN', 'MANAGER'].includes(r));
    const viewAll = view === 'all' && isAdmin;
    const result = await this.call(() =>
      this.grpc!.getMyWarrantyClaims({
        userId: user.sub,
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        viewAll,
      }),
    );
    const r = result as Record<string, unknown>;
    return {
      data: (r.data as unknown[]) ?? [],
      meta: {
        total: r.total ?? 0,
        page: r.page ?? 1,
        limit: r.limit ?? 10,
        lastPage: r.lastPage ?? 0,
      },
    };
  }

  @Get(':id')
  async getClaim(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.grpc!.getWarrantyClaim({ id }));
  }

  @Patch(':id/review')
  @Permissions(Permission.OrderWrite)
  async reviewClaim(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReviewWarrantyClaimDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.reviewWarrantyClaim({
        id,
        action: dto.action,
        extraFee: dto.extraFee ?? 0,
        managerNote: dto.managerNote ?? '',
        managerId: user.sub,
      }),
    );
  }

  @Patch(':id/confirm')
  async confirmClaim(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.confirmWarrantyClaim({ id, userId: user.sub }),
    );
  }

  @Post(':id/payments')
  async initiatePayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.initiateClaimPayment({
        claimId: id,
        userId: user.sub,
        returnUrl: '',
        cancelUrl: '',
      }),
    );
  }

  @Post(':id/receive')
  @Permissions(Permission.OrderWrite)
  async receiveServiceTicket(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReceiveServiceTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.receiveServiceTicket({
        claimId: id,
        conditionNote: dto.conditionNote ?? '',
        receivedImages: dto.receivedImages ?? [],
        jewelerId: dto.jewelerId,
        staffId: user.sub,
      }),
    );
  }

  @Patch(':id/complete')
  @Permissions(Permission.OrderWrite)
  async completeServiceTicket(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteServiceTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.completeServiceTicket({
        claimId: id,
        resultNote: dto.resultNote ?? '',
        costUpdate: dto.costUpdate ?? 0,
        jewelerId: user.sub,
      }),
    );
  }

  @Patch(':id/return')
  @Permissions(Permission.OrderWrite)
  async returnClaim(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.returnWarrantyClaim({ id, staffId: user.sub }),
    );
  }
}
