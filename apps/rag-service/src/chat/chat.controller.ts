import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SkipTimeout } from '@app/common';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @GrpcMethod('KnowledgeService', 'CreateChatSession')
  createChatSession(data: {
    userId: string;
    workspaceId: string;
    title?: string;
  }) {
    return this.chatService.createSession(data);
  }

  @GrpcMethod('KnowledgeService', 'FindChatSessions')
  findChatSessions(data: { userId: string; workspaceId: string }) {
    return this.chatService.findSessions(data);
  }

  @GrpcMethod('KnowledgeService', 'GetChatMessages')
  getChatMessages(data: { userId: string; sessionId: string }) {
    return this.chatService.getMessages(data);
  }

  @SkipTimeout()
  @GrpcMethod('KnowledgeService', 'AskQuestion')
  askQuestion(data: {
    userId: string;
    workspaceId: string;
    chatSessionId?: string;
    documentIds?: string[];
    question: string;
  }) {
    return this.chatService.ask(data);
  }
}
