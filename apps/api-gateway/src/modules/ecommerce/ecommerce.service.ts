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

type EcommerceGrpcService = {
  ping(data: PingRequest): Observable<PingResponse>;
};

@Injectable()
export class EcommerceService implements OnModuleInit {
  private ecommerceGrpcService?: EcommerceGrpcService;

  constructor(
    @Optional()
    @Inject('ECOMMERCE_SERVICE')
    private readonly ecommerceClient?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.ecommerceGrpcService =
      this.ecommerceClient?.getService<EcommerceGrpcService>('EcommerceService');
  }

  getHealth(): { status: string; message: string; timestamp: string } {
    return {
      status: 'ok',
      message: 'API Gateway is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  async pingMicroservice(data = 'ping from api-gateway') {
    if (!this.ecommerceGrpcService) {
      return {
        pong: false,
        receivedAt: new Date().toISOString(),
        data: 'ECOMMERCE_SERVICE gRPC client is not initialized',
      };
    }

    return lastValueFrom(this.ecommerceGrpcService.ping({ data }));
  }
}
