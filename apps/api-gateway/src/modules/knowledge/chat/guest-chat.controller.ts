import {
  ChatQueryDto,
  CreateChatSessionDto,
  Public,
  SkipTimeout,
} from '@app/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { KnowledgeService } from '../knowledge.service';
import {
  ApiCreateGuestChatSessionDocs,
  ApiFindGuestChatSessionsDocs,
  ApiGetGuestChatMessagesDocs,
  ApiGuestAskQuestionDocs,
} from './guest-chat.swagger';
import { ensureGuestSessionId } from './guest-session.util';

@ApiTags('Knowledge - Chat (Guest)')
@Public()
@Controller('api/v1/knowledge/chat/guest')
export class GuestChatController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('sessions')
  @ApiCreateGuestChatSessionDocs()
  createSession(
    @Body() body: CreateChatSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const guestSessionId = ensureGuestSessionId(req, res);
    return this.knowledgeService.createGuestChatSession(
      guestSessionId,
      body.title,
    );
  }

  @Get('sessions')
  @ApiFindGuestChatSessionsDocs()
  findSessions(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const guestSessionId = ensureGuestSessionId(req, res);
    return this.knowledgeService.findGuestChatSessions(guestSessionId);
  }

  @Get('sessions/:sessionId/messages')
  @ApiGetGuestChatMessagesDocs()
  getMessages(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('limit') limitRaw?: string,
    @Query('before') before?: string,
  ) {
    const guestSessionId = ensureGuestSessionId(req, res);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.knowledgeService.getGuestChatMessages(
      guestSessionId,
      sessionId,
      limit,
      before,
    );
  }

  @Post('query')
  @SkipTimeout()
  @ApiGuestAskQuestionDocs()
  ask(
    @Body() body: ChatQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const guestSessionId = ensureGuestSessionId(req, res);
    return this.knowledgeService.askGuestQuestion(
      guestSessionId,
      body.question,
      body.chatSessionId,
    );
  }
}
