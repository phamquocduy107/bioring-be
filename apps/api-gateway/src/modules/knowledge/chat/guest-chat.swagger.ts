import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

const guestSessionExample = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  workspaceId: 'bioring-catalog',
  userId: '',
  guestSessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  title: 'Tư vấn nhẫn cưới',
  createdAt: '2026-07-29T02:00:00.000Z',
  updatedAt: '2026-07-29T02:00:00.000Z',
};

const guestAskExample = {
  messageId: '550e8400-e29b-41d4-a716-446655440021',
  sessionId: '550e8400-e29b-41d4-a716-446655440010',
  type: 'policy_answer',
  intent: 'POLICY_QA',
  answer: 'Theo chính sách cửa hàng...',
  sources: [],
  suggestedProducts: [],
  suggestedPackages: [],
  missingFields: [],
  productFilters: {},
  shouldAskClarifyingQuestion: false,
};

const cookieNote =
  'Public guest chat. Dùng cookie `guest_session_id` (HttpOnly). ' +
  'Nếu chưa có, gateway tự set cookie trên response. FE cần `credentials: include`.';

export function ApiCreateGuestChatSessionDocs() {
  return applyDecorators(
    ApiCookieAuth(GUEST_COOKIE_SCHEME),
    ApiOperation({
      summary: 'Guest — create chat session',
      description: cookieNote,
    }),
    ApiBody({
      schema: {
        example: { title: 'Tư vấn nhẫn' },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Guest chat session created.',
      schema: { example: { session: guestSessionExample } },
    }),
  );
}

export function ApiFindGuestChatSessionsDocs() {
  return applyDecorators(
    ApiCookieAuth(GUEST_COOKIE_SCHEME),
    ApiOperation({
      summary: 'Guest — list chat sessions',
      description: cookieNote,
    }),
    ApiResponse({
      status: 200,
      description: 'Sessions for this guest cookie.',
      schema: { example: { sessions: [guestSessionExample] } },
    }),
  );
}

export function ApiGetGuestChatMessagesDocs() {
  return applyDecorators(
    ApiCookieAuth(GUEST_COOKIE_SCHEME),
    ApiOperation({
      summary: 'Guest — get chat messages',
      description: cookieNote,
    }),
    ApiParam({
      name: 'sessionId',
      description: 'Chat session UUID owned by this guest cookie',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 30,
      description: 'Số tin nhắn mỗi page (default 50, max 100).',
    }),
    ApiQuery({
      name: 'before',
      required: false,
      type: String,
      format: 'uuid',
      description:
        'Cursor messageId. Lần đầu bỏ trống; lần sau dùng nextCursor để lấy tin cũ hơn.',
    }),
    ApiResponse({
      status: 200,
      description: 'Message history page (messages + hasMore + nextCursor).',
    }),
    ApiResponse({ status: 404, description: 'Chat session not found' }),
  );
}

export function ApiGuestAskQuestionDocs() {
  return applyDecorators(
    ApiCookieAuth(GUEST_COOKIE_SCHEME),
    ApiOperation({
      summary: 'Guest — ask chat question',
      description:
        cookieNote +
        ' Không hỗ trợ documentIds riêng (chỉ knowledge workspace chung).',
    }),
    ApiBody({
      schema: {
        example: {
          question: 'Nhẫn vàng trắng dưới 10 triệu có mẫu nào?',
          chatSessionId: '550e8400-e29b-41d4-a716-446655440010',
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Chat answer.',
      schema: { example: guestAskExample },
    }),
  );
}

/** Swagger cookie scheme name (must match DocumentBuilder if registered). */
export const GUEST_COOKIE_SCHEME = 'guest-session';
