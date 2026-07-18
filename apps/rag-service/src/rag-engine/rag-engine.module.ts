import { Module } from '@nestjs/common';
import { RagEngineClient } from './rag-engine.client';

/**
 * HTTP integration với Python rag-engine
 * (intent/detect, /query). Không chứa Qdrant/LLM trong Nest.
 */
@Module({
  providers: [RagEngineClient],
  exports: [RagEngineClient],
})
export class RagEngineModule {}
