import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

export function ApiCreateDesignDraftDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a new design draft (guest)' }),
    ApiResponse({ status: 201, description: 'Design draft created' }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
  );
}

export function ApiGetDesignDraftByCodeDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get design draft by design code' }),
    ApiResponse({ status: 200, description: 'Design draft detail' }),
    ApiResponse({ status: 404, description: 'Design draft not found' }),
  );
}

export function ApiGetMyDraftsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get my design drafts (by guest session cookie)' }),
    ApiResponse({ status: 200, description: 'List of design drafts' }),
  );
}

export function ApiUpdateDesignDraftDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a design draft' }),
    ApiResponse({ status: 200, description: 'Design draft updated' }),
    ApiResponse({ status: 404, description: 'Design draft not found' }),
  );
}

export function ApiClaimDesignDraftDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Claim a design draft (mobile, requires JWT)' }),
    ApiResponse({ status: 200, description: 'Design draft claimed' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Design draft not found' }),
  );
}
