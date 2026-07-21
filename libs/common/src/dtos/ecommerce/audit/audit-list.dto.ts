import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AuditLogActorDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
}

export class AuditLogEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() timestamp!: string;
  @ApiProperty() actor!: AuditLogActorDto | null;
  @ApiProperty() action!: string;
  @ApiProperty() resource!: string;
  @ApiProperty() resource_id!: string;
  @ApiProperty() description!: string;
  @ApiProperty() result!: string;
  @ApiProperty() metadata!: unknown;
}

export class ListAuditLogsDto {
  @ApiProperty({ type: [AuditLogEntryDto] })
  data!: AuditLogEntryDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() last_page!: number;
}

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({ example: 'order' })
  @IsOptional()
  resource?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  to_date?: string;
}
