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

type IdentityGrpcService = {
  ping(data: PingRequest): Observable<PingResponse>;
};

@Injectable()
export class IdentityService implements OnModuleInit {
  private identityGrpcService?: IdentityGrpcService;

  constructor(
    @Optional()
    @Inject('IDENTITY_SERVICE')
    private readonly identityClient?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.identityGrpcService =
      this.identityClient?.getService<IdentityGrpcService>('IdentityService');
  }

  getHealth(): { status: string; message: string; timestamp: string } {
    return {
      status: 'ok',
      message: 'API Gateway is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  async pingMicroservice(data = 'ping from api-gateway') {
    if (!this.identityGrpcService) {
      return {
        pong: false,
        receivedAt: new Date().toISOString(),
        data: 'IDENTITY_SERVICE gRPC client is not initialized',
      };
    }

    return lastValueFrom(this.identityGrpcService.ping({ data }));
  }
}
