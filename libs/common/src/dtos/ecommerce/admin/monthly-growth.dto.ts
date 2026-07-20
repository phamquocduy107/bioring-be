import { ApiProperty } from '@nestjs/swagger';

export class MonthlyRevenueDto {
  @ApiProperty({ example: 'Jul', description: 'Month name' })
  month!: string;

  @ApiProperty({ example: 45000000, description: 'Revenue (VND)' })
  revenue!: number;
}

export class MonthlyGrowthDto {
  @ApiProperty({ type: [MonthlyRevenueDto], description: 'Monthly revenue' })
  data!: MonthlyRevenueDto[];
}
