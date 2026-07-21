import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { EngineModule } from '../engine/engine.module';
import { BiometricAssetController } from './biometric-asset.controller';
import { BiometricAssetService } from './biometric-asset.service';

@Module({
  imports: [PrismaModule, EngineModule],
  controllers: [BiometricAssetController],
  providers: [BiometricAssetService],
  exports: [BiometricAssetService],
})
export class BiometricAssetModule {}
