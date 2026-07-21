import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { CatalogModule } from '../catalog/catalog.module';
import { DocumentsModule } from '../documents/documents.module';
import { RagEngineModule } from '../rag-engine/rag-engine.module';
import { AiChatRepository } from './ai-chat.repository';
import { ChatContextService } from './chat-context.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationSummaryService } from './conversation-summary.service';
import { WorkspacePermissionService } from './workspace-permission.service';

/**
 * Chat tư vấn nhẫn: session/message DB, intent orchestration, gọi rag-engine.
 */
@Module({
  imports: [PrismaModule, DocumentsModule, RagEngineModule, CatalogModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatContextService,
    ConversationSummaryService,
    AiChatRepository,
    WorkspacePermissionService,
  ],
})
export class ChatModule {}
