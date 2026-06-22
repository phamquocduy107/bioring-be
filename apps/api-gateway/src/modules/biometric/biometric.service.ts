import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';

type PingRequest = {
  data: string;
};

type PingResponse = {
  pong: boolean;
  receivedAt: string;
  data: string;
};

type BiometricGrpcService = {
  ping(data: PingRequest): Observable<PingResponse>;
};

@Injectable()
export class BiometricService implements OnModuleInit {
  private biometricGrpcService?: BiometricGrpcService;

  constructor(
    @Optional()
    @Inject('BIOMETRIC_SERVICE')
    private readonly biometricClient?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.biometricGrpcService =
      this.biometricClient?.getService<BiometricGrpcService>(
        'BiometricService',
      );
  }

  getHealth(): { status: string; message: string; timestamp: string } {
    return {
      status: 'ok',
      message: 'API Gateway is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  async pingMicroservice(data = 'ping from api-gateway') {
    if (!this.biometricGrpcService) {
      return {
        pong: false,
        receivedAt: new Date().toISOString(),
        data: 'BIOMETRIC_SERVICE gRPC client is not initialized',
      };
    }

    return lastValueFrom(this.biometricGrpcService.ping({ data }));
  }
}
