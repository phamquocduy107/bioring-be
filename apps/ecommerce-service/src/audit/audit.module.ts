import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { AuditListener } from './audit.listener';

@Module({
  imports: [PrismaModule],
  providers: [AuditListener],
})
export class AuditModule {}
