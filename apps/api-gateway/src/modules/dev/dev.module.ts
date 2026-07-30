import { Module } from '@nestjs/common';
import { NotificationModule } from '@app/common';
import { EmailTestController } from './email-test.controller';
import { EmailTestService } from './email-test.service';

@Module({
  imports: [NotificationModule],
  controllers: [EmailTestController],
  providers: [EmailTestService],
})
export class DevModule {}
