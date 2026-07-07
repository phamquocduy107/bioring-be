import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OrderLookupDto {
  @ApiProperty({ description: 'Order code', example: 'BIORING-ABC123' })
  @IsString()
  orderCode!: string;
}
