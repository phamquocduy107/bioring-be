import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ChatQueryDto,
  CreateChatSessionDto,
  CurrentUser,
  SkipTimeout,
} from '@app/common';
import type { JwtPayload } from '@app/common';
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
    return this.knowledgeService.createChatSession(user.sub, body.title);
  }

  @Get('sessions')
  @ApiFindChatSessionsDocs()
  findSessions(@CurrentUser() user: JwtPayload) {
    return this.knowledgeService.findChatSessions(user.sub);
  }

  @Get('sessions/:sessionId/messages')
  @ApiGetChatMessagesDocs()
  getMessages(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.knowledgeService.getChatMessages(user.sub, sessionId);
  }

  @Post('query')
  @SkipTimeout()
  @ApiAskQuestionDocs()
  ask(@Body() body: ChatQueryDto, @CurrentUser() user: JwtPayload) {
    return this.knowledgeService.askQuestion(
      user.sub,
      body.question,
      body.chatSessionId,
      body.documentIds,
    );
  }
}
