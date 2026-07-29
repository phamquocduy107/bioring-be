import { SkipTimeout } from '@app/common';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @GrpcMethod('KnowledgeService', 'CreateChatSession')
  createChatSession(data: {
    userId?: string;
    guestSessionId?: string;
    workspaceId: string;
    title?: string;
  }) {
    // gRPC entrypoint từ API gateway.
    return this.chatService.createSession(data);
  }

  @GrpcMethod('KnowledgeService', 'FindChatSessions')
  findChatSessions(data: {
    userId?: string;
    guestSessionId?: string;
    workspaceId: string;
  }) {
    // Trả danh sách session theo user/workspace hoặc guest cho gateway.
    return this.chatService.findSessions(data);
  }

  @GrpcMethod('KnowledgeService', 'GetChatMessages')
  getChatMessages(data: {
    userId?: string;
    guestSessionId?: string;
    sessionId: string;
    limit?: number;
    before?: string;
  }) {
    // Lấy message đã lưu (cursor pagination: limit + before)
    return this.chatService.getMessages(data);
  }

  @SkipTimeout()
  @GrpcMethod('KnowledgeService', 'AskQuestion')
  askQuestion(data: {
    userId?: string;
    guestSessionId?: string;
    workspaceId: string;
    chatSessionId?: string;
    documentIds?: string[];
    question: string;
  }) {
    // Chat query chính: ChatService điều phối context/intent/catalog rồi mới gọi Python.
    return this.chatService.ask(data);
  }
}
