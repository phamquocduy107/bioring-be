import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { EngineModule } from '../engine/engine.module';
import { AttachBiometricController } from './attach-biometric.controller';
import { AttachBiometricService } from './attach-biometric.service';

@Module({
  imports: [PrismaModule, EngineModule],
  controllers: [AttachBiometricController],
  providers: [AttachBiometricService],
})
export class AttachBiometricModule {}
