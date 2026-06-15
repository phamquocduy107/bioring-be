export interface JwtPayload {
  sub: string; // user.id (UUID)
  email: string;
  role: string[]; // Array of role names
}

import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}
