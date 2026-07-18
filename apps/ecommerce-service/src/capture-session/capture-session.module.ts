import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { CaptureSessionController } from './capture-session.controller';
import { CaptureSessionService } from './capture-session.service';

@Module({
  imports: [PrismaModule],
  controllers: [CaptureSessionController],
  providers: [CaptureSessionService],
})
export class CaptureSessionModule {}
