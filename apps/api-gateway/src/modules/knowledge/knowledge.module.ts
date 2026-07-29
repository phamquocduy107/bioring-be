import { KNOWLEDGE_GRPC_CHANNEL_OPTIONS, KNOWLEDGE_GRPC_LOADER_OPTIONS } from '@app/common';
import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DocumentsController } from './documents/documents.controller';
import { ChatController } from './chat/chat.controller';
import { GuestChatController } from './chat/guest-chat.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KNOWLEDGE_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'knowledge',
          protoPath: join(process.cwd(), 'proto/knowledge.proto'),
          url: process.env.KNOWLEDGE_GRPC_URL ?? 'localhost:50054',
          channelOptions: KNOWLEDGE_GRPC_CHANNEL_OPTIONS,
          loader: KNOWLEDGE_GRPC_LOADER_OPTIONS,
        },
      },
    ]),
  ],
  controllers: [DocumentsController, ChatController, GuestChatController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
