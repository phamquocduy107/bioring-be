import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { WarrantyService } from './warranty.service';

@Controller()
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @GrpcMethod('EcommerceService', 'CreateWarrantyClaim')
  async createClaim(data: {
    warrantyId: string;
    orderId: string;
    serviceType: string;
    issueDescription: string;
    proofImages: string[];
    proofVideos: string[];
    userId: string;
  }) {
    return this.warrantyService.createClaim(data);
  }

  @GrpcMethod('EcommerceService', 'CreateWarrantyClaimByLookup')
  async createClaimByLookup(data: {
    orderCode: string;
    serviceType: string;
    issueDescription: string;
    proofImages: string[];
    proofVideos: string[];
  }) {
    return this.warrantyService.createClaimByLookup(data);
  }

  @GrpcMethod('EcommerceService', 'GetWarrantyClaim')
  async getClaim(data: { id: string }) {
    return this.warrantyService.getClaim(data.id);
  }

  @GrpcMethod('EcommerceService', 'GetMyWarrantyClaims')
  async getMyClaims(data: { userId: string; page?: number; limit?: number }) {
    return this.warrantyService.getMyClaims(
      data.userId,
      data.page ?? 1,
      data.limit ?? 10,
    );
  }

  @GrpcMethod('EcommerceService', 'ReviewWarrantyClaim')
  async reviewClaim(data: {
    id: string;
    action: string;
    extraFee: number;
    managerNote: string;
    managerId: string;
  }) {
    return this.warrantyService.reviewClaim(
      data.id,
      data.action,
      data.extraFee,
      data.managerNote,
      data.managerId,
    );
  }

  @GrpcMethod('EcommerceService', 'ConfirmWarrantyClaim')
  async confirmClaim(data: { id: string; userId: string }) {
    return this.warrantyService.confirmClaim(data.id, data.userId);
  }

  @GrpcMethod('EcommerceService', 'InitiateClaimPayment')
  async initiateClaimPayment(data: {
    claimId: string;
    userId: string;
    returnUrl: string;
    cancelUrl: string;
  }) {
    return this.warrantyService.initiateClaimPayment(
      data.claimId,
      data.userId,
      data.returnUrl,
      data.cancelUrl,
    );
  }

  @GrpcMethod('EcommerceService', 'ReceiveServiceTicket')
  async receiveServiceTicket(data: {
    claimId: string;
    conditionNote: string;
    receivedImages: string[];
    jewelerId: string;
    staffId: string;
  }) {
    return this.warrantyService.receiveServiceTicket(data.claimId, data);
  }

  @GrpcMethod('EcommerceService', 'CompleteServiceTicket')
  async completeServiceTicket(data: {
    claimId: string;
    resultNote: string;
    costUpdate: number;
    jewelerId: string;
  }) {
    return this.warrantyService.completeServiceTicket(data.claimId, data);
  }

  @GrpcMethod('EcommerceService', 'ReturnWarrantyClaim')
  async returnClaim(data: { id: string; staffId: string }) {
    return this.warrantyService.returnClaim(data.id, data.staffId);
  }
}
