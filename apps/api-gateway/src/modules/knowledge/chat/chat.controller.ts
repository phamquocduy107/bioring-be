import type { JwtPayload } from '@app/common';
import {
  ChatQueryDto,
  CreateChatSessionDto,
  CurrentUser,
  SkipTimeout,
} from '@app/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from '../knowledge.service';
import {
  ApiAskQuestionDocs,
  ApiCreateChatSessionDocs,
  ApiFindChatSessionsDocs,
  ApiGetChatMessagesDocs,
} from './chat.swagger';

@ApiTags('Knowledge - Chat')
@ApiBearerAuth('access-token')
@Controller('knowledge/chat')
export class ChatController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('sessions')
  @ApiCreateChatSessionDocs()
  createSession(
    @Body() body: CreateChatSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // HTTP gateway nhận request từ FE và chuyển tạo session sang rag-service qua gRPC.
    return this.knowledgeService.createChatSession(user.sub, body.title);
  }

  @Get('sessions')
  @ApiFindChatSessionsDocs()
  findSessions(@CurrentUser() user: JwtPayload) {
    // Không đọc DB ở gateway; rag-service trả danh sách session của user.
    return this.knowledgeService.findChatSessions(user.sub);
  }

  @Get('sessions/:sessionId/messages')
  @ApiGetChatMessagesDocs()
  getMessages(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Gateway chỉ validate param/user rồi proxy lấy message sang rag-service.
    return this.knowledgeService.getChatMessages(user.sub, sessionId);
  }

  @Post('query')
  @SkipTimeout()
  @ApiAskQuestionDocs()
  ask(@Body() body: ChatQueryDto, @CurrentUser() user: JwtPayload) {
    // Luồng chat chính: gateway -> rag-service;
    return this.knowledgeService.askQuestion(
      user.sub,
      body.question,
      body.chatSessionId,
      body.documentIds,
    );
  }
}
