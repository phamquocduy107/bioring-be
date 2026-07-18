import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { AuditListener } from './audit.listener';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditListener, AuditService],
})
export class AuditModule {}
