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

type TestGrpcService = {
  ping(data: PingRequest): Observable<PingResponse>;
};

@Injectable()
export class TestServiceService implements OnModuleInit {
  private testGrpcService?: TestGrpcService;

  constructor(
    @Optional()
    @Inject('TEST_SERVICE')
    private readonly testClient?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.testGrpcService =
      this.testClient?.getService<TestGrpcService>('TestService');
  }

  async ping(data = 'ping from api-gateway') {
    if (!this.testGrpcService) {
      return {
        pong: false,
        receivedAt: new Date().toISOString(),
        data: 'TEST_SERVICE gRPC client is not initialized',
      };
    }

    return lastValueFrom(this.testGrpcService.ping({ data }));
  }
}
