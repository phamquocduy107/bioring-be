import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/common';
import { IdentityService } from './identity.service';

@ApiTags('Identity')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return this.identityService.getHealth();
  }

  @Public()
  @Get('ping')
  @ApiOperation({ summary: 'Ping identity service through gRPC' })
  pingMicroservice() {
    return this.identityService.pingMicroservice();
  }
}
