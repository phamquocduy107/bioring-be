import { SetMetadata } from '@nestjs/common';

export const SKIP_TIMEOUT = 'skip_timeout';
export const SkipTimeout = () => SetMetadata(SKIP_TIMEOUT, true);
