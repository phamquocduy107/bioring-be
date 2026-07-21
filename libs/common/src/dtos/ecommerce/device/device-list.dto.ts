import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeviceInfoDto {
  @ApiProperty() id!: string;
  @ApiProperty() serial_number!: string;
  @ApiProperty() model!: string;
  @ApiProperty() status!: string;
  @ApiProperty() firmware!: string;
  @ApiProperty() last_seen!: string;
  @ApiProperty() rssi!: number | null;
  @ApiProperty() uptime!: number | null;
  @ApiProperty() cpu!: number | null;
  @ApiProperty() memory!: number | null;
}

export class ListDevicesDto {
  @ApiProperty({ type: [DeviceInfoDto] }) data!: DeviceInfoDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() last_page!: number;
}

export class ListDevicesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
  @ApiPropertyOptional({ example: 'online' }) @IsOptional() status?: string;
  @ApiPropertyOptional({ example: 'ABC' }) @IsOptional() search?: string;
}

export class CreateDeviceBodyDto {
  @ApiProperty() @IsString() @IsNotEmpty() device_name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() mac_address!: string;
  @ApiProperty() @IsString() @IsNotEmpty() device_type!: string;
}

export class UpdateDeviceBodyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() device_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() device_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firmware_version?: string;
}
