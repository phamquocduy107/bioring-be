import { Module } from '@nestjs/common';
import { PersonalizationEngineClient } from './personalization-engine.client';

@Module({
  providers: [PersonalizationEngineClient],
  exports: [PersonalizationEngineClient],
})
export class EngineModule {}
