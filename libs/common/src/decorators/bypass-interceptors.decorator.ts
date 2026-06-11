import { SetMetadata } from '@nestjs/common';

export const BYPASS_INTERCEPTORS = 'bypass_interceptors';
export const BypassInterceptors = () => SetMetadata(BYPASS_INTERCEPTORS, true);
