import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CaptureSessionService } from './capture-session.service';

@Controller()
export class CaptureSessionController {
  constructor(private readonly service: CaptureSessionService) {}

  @GrpcMethod('EcommerceService', 'CreateCaptureSession')
  async createSession(data: {
    orderId: string;
    staffId: string;
    deviceId?: string;
  }) {
    return this.service.createSession(data);
  }

  @GrpcMethod('EcommerceService', 'CompleteCaptureSession')
  async completeSession(data: {
    id: string;
    qualityScore?: number;
    staffNote?: string;
  }) {
    return this.service.completeSession(data.id, {
      qualityScore: data.qualityScore,
      staffNote: data.staffNote,
    });
  }

  @GrpcMethod('EcommerceService', 'GetCaptureSessions')
  async getSessions(data: { orderId?: string }) {
    return this.service.getSessions(data);
  }

  @GrpcMethod('EcommerceService', 'GetCaptureSession')
  async getSession(data: { id: string }) {
    return this.service.getSession(data.id);
  }
}
