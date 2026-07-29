import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ApiAuthFailures } from '@app/common';

const chatSessionExample = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  workspaceId: 'bioring-catalog',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  title: 'Hỏi về chính sách công ty',
  createdAt: '2026-07-10T02:00:00.000Z',
  updatedAt: '2026-07-10T02:00:00.000Z',
};

const chatMessageExample = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  sessionId: '550e8400-e29b-41d4-a716-446655440010',
  role: 'assistant',
  content: 'Theo tài liệu, chính sách nghỉ phép là 12 ngày/năm.',
  createdAt: '2026-07-10T02:01:00.000Z',
};

const policyAnswerExample = {
  messageId: '550e8400-e29b-41d4-a716-446655440021',
  sessionId: '550e8400-e29b-41d4-a716-446655440010',
  type: 'policy_answer',
  intent: 'POLICY_QA',
  answer: 'Theo chính sách cửa hàng...',
  sources: [
    {
      documentId: 'doc_123',
      source: 'policy.pdf',
      page: 2,
      chunkIndex: 5,
      score: 0.82,
      contentPreview: '',
    },
  ],
  suggestedProducts: [],
  suggestedPackages: [],
  missingFields: [],
  productFilters: {},
  shouldAskClarifyingQuestion: false,
};

const ringRecommendationExample = {
  messageId: '550e8400-e29b-41d4-a716-446655440022',
  sessionId: '550e8400-e29b-41d4-a716-446655440010',
  type: 'ring_recommendation',
  intent: 'RING_RECOMMENDATION',
  answer: 'Dựa trên ngân sách và sở thích của bạn, tôi gợi ý...',
  sources: [],
  suggestedProducts: [
    {
      id: 'ring_001',
      name: 'Minimal Sapphire Ring',
      price: 8500000,
      material: 'white_gold',
      style: 'minimal',
      stoneName: 'sapphire',
      stoneColor: 'blue',
      reason: 'Phù hợp ngân sách dưới 10 triệu và phong cách tối giản.',
    },
  ],
  suggestedPackages: [],
  missingFields: [],
  productFilters: {
    purpose: 'engagement',
    budgetMax: 10000000,
    stoneColor: 'blue',
    style: 'minimal',
  },
  shouldAskClarifyingQuestion: false,
};

const clarificationExample = {
  messageId: '550e8400-e29b-41d4-a716-446655440023',
  sessionId: '550e8400-e29b-41d4-a716-446655440010',
  type: 'clarification',
  intent: 'RING_RECOMMENDATION',
  answer:
    'Bạn muốn nhẫn dùng cho dịp nào: cầu hôn, cưới, kỷ niệm hay đeo hằng ngày?',
  sources: [],
  suggestedProducts: [],
  suggestedPackages: [],
  missingFields: ['purpose', 'budgetMax', 'style'],
  productFilters: {},
  shouldAskClarifyingQuestion: true,
};

export function ApiCreateChatSessionDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Create chat session',
      description:
        'Tạo phiên chat mới. workspaceId được gán tự động phía server.',
    }),
    ApiBody({
      schema: {
        example: {
          title: 'Hỏi về chính sách công ty',
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Chat session created.',
      schema: { example: { session: chatSessionExample } },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiAuthFailures(),
  );
}

export function ApiFindChatSessionsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'List chat sessions',
      description:
        'Lấy danh sách phiên chat trong workspace mặc định của hệ thống.',
    }),
    ApiResponse({
      status: 200,
      description: 'List of chat sessions.',
      schema: {
        example: {
          sessions: [chatSessionExample],
        },
      },
    }),
    ApiAuthFailures(),
  );
}

export function ApiGetChatMessagesDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get chat messages',
      description: 'Lấy lịch sử tin nhắn của một phiên chat.',
    }),
    ApiParam({
      name: 'sessionId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440010',
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
        'Cursor: messageId của tin cũ nhất FE đang có. ' +
        'Lần đầu bỏ trống (lấy N tin mới nhất). ' +
        'Scroll lên → truyền nextCursor từ response trước để lấy tin cũ hơn.',
    }),
    ApiResponse({
      status: 200,
      description: 'Chat message history (cursor page).',
      schema: {
        example: {
          messages: [
            {
              ...chatMessageExample,
              role: 'user',
              content: 'Chính sách nghỉ phép là gì?',
            },
            chatMessageExample,
          ],
          hasMore: true,
          nextCursor: '550e8400-e29b-41d4-a716-446655440020',
        },
      },
    }),
    ApiResponse({ status: 404, description: 'Chat session not found' }),
    ApiAuthFailures(),
  );
}

export function ApiAskQuestionDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary:
        'Ask question, ask policy/package, or request ring recommendation',
      description:
        'Ask question, ask policy/package, or request ring recommendation. The system automatically detects intent per message and supports intent switching in the same chat session.',
    }),
    ApiBody({
      schema: {
        example: {
          chatSessionId: '550e8400-e29b-41d4-a716-446655440010',
          documentIds: ['550e8400-e29b-41d4-a716-446655440001'],
          question: 'Shop có bảo hành không?',
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'policy_answer example',
      schema: { example: policyAnswerExample },
    }),
    ApiResponse({
      status: 200,
      description: 'ring_recommendation example',
      schema: { example: ringRecommendationExample },
    }),
    ApiResponse({
      status: 200,
      description: 'clarification example',
      schema: { example: clarificationExample },
    }),
    ApiResponse({
      status: 200,
      description: 'intent switching example (policy after ring advice)',
      schema: {
        example: {
          messageId: '550e8400-e29b-41d4-a716-446655440024',
          sessionId: '550e8400-e29b-41d4-a716-446655440010',
          type: 'policy_answer',
          intent: 'POLICY_QA',
          answer: 'Theo chính sách bảo hành...',
          sources: [],
          suggestedProducts: [],
          suggestedPackages: [],
          missingFields: [],
          productFilters: {},
          shouldAskClarifyingQuestion: false,
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiAuthFailures(),
  );
}
