import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty({ example: 156, description: 'Total orders' })
  totalOrders!: number;

  @ApiProperty({ example: 89, description: 'Completed orders' })
  completedOrders!: number;

  @ApiProperty({ example: 1250000000, description: 'Total revenue (VND)' })
  totalRevenue!: number;

  @ApiProperty({ example: 342, description: 'Active registered users' })
  activeUsers!: number;
}
