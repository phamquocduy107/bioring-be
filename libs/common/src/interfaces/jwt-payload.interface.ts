export interface JwtPayload {
  sub: string; // user.id (UUID)
  email: string;
  role: string[]; // Array of role names
}
