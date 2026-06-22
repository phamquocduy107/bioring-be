import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/common';
import { BiometricService } from './biometric.service';

@ApiTags('Biometric')
@Controller('biometric')
export class BiometricController {
  constructor(private readonly biometricService: BiometricService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return this.biometricService.getHealth();
  }

  @Public()
  @Get('ping')
  @ApiOperation({ summary: 'Ping biometric service through gRPC' })
  pingMicroservice() {
    return this.biometricService.pingMicroservice();
  }
}
