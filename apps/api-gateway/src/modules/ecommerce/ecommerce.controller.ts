import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/common';
import { EcommerceService } from './ecommerce.service';

@ApiTags('Ecommerce')
@Controller('ecommerce')
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return this.ecommerceService.getHealth();
  }

  @Public()
  @Get('ping')
  @ApiOperation({ summary: 'Ping ecommerce service through gRPC' })
  pingMicroservice() {
    return this.ecommerceService.pingMicroservice();
  }
}
