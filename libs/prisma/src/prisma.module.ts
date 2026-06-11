import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { appConfig } from '@app/common/config/app.config';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule.forRoot(appConfig)],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
