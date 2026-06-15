import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RefreshTokenCommandDto {
  @IsString()
  @IsNotEmpty()
  oldRefreshToken: string;

  @IsOptional()
  @IsString()
  deviceAgent: string;

  @IsOptional()
  @IsString()
  ipAddress: string;
}

export class LogoutCommandDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
