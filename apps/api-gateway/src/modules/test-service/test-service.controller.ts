import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/common';
import { TestServiceService } from './test-service.service';

@ApiTags('Test Service')
@Controller('test-service')
export class TestServiceController {
  constructor(private readonly testServiceService: TestServiceService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check for test-service integration' })
  getHealth() {
    return {
      status: 'ok',
      message: 'API Gateway → Test Service (gRPC) integration is active',
    };
  }

  @Public()
  @Get('ping')
  @ApiOperation({ summary: 'Ping test-service through gRPC' })
  pingUpstream() {
    return this.testServiceService.ping();
  }
}
