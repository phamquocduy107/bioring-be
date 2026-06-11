export interface RequestWithUser extends Request {
  user: {
    accessToken: string;
    refreshToken: string;
  };
  query: {
    state: string;
  };
}
