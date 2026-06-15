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

type SampleGrpcService = {
  ping(data: PingRequest): Observable<PingResponse>;
};

@Injectable()
export class SampleService implements OnModuleInit {
  private sampleGrpcService?: SampleGrpcService;

  constructor(
    @Optional()
    @Inject('SAMPLE_SERVICE')
    private readonly sampleClient?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.sampleGrpcService =
      this.sampleClient?.getService<SampleGrpcService>('SampleService');
  }

  getHealth(): { status: string; message: string; timestamp: string } {
    return {
      status: 'ok',
      message: 'API Gateway is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  async pingMicroservice(data = 'ping from api-gateway') {
    if (!this.sampleGrpcService) {
      return {
        pong: false,
        receivedAt: new Date().toISOString(),
        data: 'SAMPLE_SERVICE gRPC client is not initialized',
      };
    }

    return lastValueFrom(this.sampleGrpcService.ping({ data }));
  }
}
