import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DayRevenueDto {
  @ApiProperty({ example: '2026-07-01', description: 'Date' })
  date!: string;

  @ApiProperty({ example: 45000000, description: 'Revenue (VND)' })
  revenue!: number;
}

export class RevenueTimelineDto {
  @ApiProperty({ type: [DayRevenueDto], description: 'Daily revenue' })
  data!: DayRevenueDto[];
}

export class RevenueTimelineQueryDto {
  @ApiPropertyOptional({ example: 7, description: 'Number of days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}
