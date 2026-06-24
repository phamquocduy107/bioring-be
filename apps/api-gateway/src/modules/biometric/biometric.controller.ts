import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@app/common';
import { BiometricService } from './biometric.service';
import { ApiHealthDocs, ApiPingMicroserviceDocs } from './biometric.swagger';

@ApiTags('Biometric')
@Controller('biometric')
export class BiometricController {
  constructor(private readonly biometricService: BiometricService) {}

  @Public()
  @Get('health')
  @ApiHealthDocs()
  getHealth() {
    return this.biometricService.getHealth();
  }

  @Public()
  @Get('ping')
  @ApiPingMicroserviceDocs()
  pingMicroservice() {
    return this.biometricService.pingMicroservice();
  }
}
