import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ProcessSoundwaveDto {
  @ApiPropertyOptional({
    description: 'Segment start offset in milliseconds',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentStartMs?: number;

  @ApiPropertyOptional({
    description: 'Segment duration in milliseconds (max 3000)',
    example: 3000,
    default: 3000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3000)
  segmentDurationMs?: number;
}
