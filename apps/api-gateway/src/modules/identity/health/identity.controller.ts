import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/common';
import { ApiTags } from '@nestjs/swagger';
import { IdentityService } from '../identity.service';
import { ApiGetHealthDocs, ApiPingMicroserviceDocs } from './identity.swagger';

@ApiTags('Health')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Public()
  @Get('health')
  @ApiGetHealthDocs()
  getHealth() {
    return this.identityService.getHealth();
  }

  @Public()
  @Get('ping')
  @ApiPingMicroserviceDocs()
  pingMicroservice() {
    return this.identityService.pingMicroservice();
  }
}
