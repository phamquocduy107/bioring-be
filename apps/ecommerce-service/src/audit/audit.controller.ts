import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuditService } from './audit.service';

@Controller()
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @GrpcMethod('EcommerceService', 'ListAuditLogs')
  async listAuditLogs(data: {
    page?: number;
    limit?: number;
    resource?: string;
    from_date?: string;
    to_date?: string;
  }) {
    return this.service.listAuditLogs({
      page: data.page ?? 1,
      limit: data.limit ?? 50,
      resource: data.resource,
      from_date: data.from_date,
      to_date: data.to_date,
    });
  }
}
