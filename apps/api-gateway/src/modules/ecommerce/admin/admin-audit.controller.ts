import {
  Controller,
  Get,
  Query,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import { Permissions, Permission, ListAuditLogsQueryDto } from '@app/common';
import { ApiListAuditLogsDocs } from './admin-audit.swagger';

interface EcommerceGrpcService {
  listAuditLogs(data: Record<string, unknown>): Observable<unknown>;
}

@Controller('api/v1/admin/audit-logs')
export class AdminAuditController implements OnModuleInit {
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
  @Permissions(Permission.AuditRead)
  @ApiListAuditLogsDocs()
  async listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.call(() =>
      this.grpc!.listAuditLogs({
        page: query.page ?? 1,
        limit: query.limit ?? 50,
        resource: query.resource ?? '',
        from_date: query.from_date ?? '',
        to_date: query.to_date ?? '',
      }),
    );
  }
}
