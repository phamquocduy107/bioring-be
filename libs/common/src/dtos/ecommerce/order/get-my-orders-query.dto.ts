import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';
import { PaginationDto } from '../../pagination.dto';

export class GetMyOrdersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Filter orders by customer email (Requires staff/manager order.write permission)',
    example: 'member@gmail.com',
  })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;
}
