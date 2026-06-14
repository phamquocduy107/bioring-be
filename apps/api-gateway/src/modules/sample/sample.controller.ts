import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/common';
import { SampleService } from './sample.service';

@ApiTags('Sample')
@Controller('sample')
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return this.sampleService.getHealth();
  }

  @Public()
  @Get('ping')
  @ApiOperation({ summary: 'Ping sample microservice through gRPC' })
  pingMicroservice() {
    return this.sampleService.pingMicroservice();
  }
}
