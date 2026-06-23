import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { DesignService } from './design.service';

@Controller()
export class DesignController {
  constructor(private readonly designService: DesignService) {}

  @GrpcMethod('EcommerceService', 'CreateDesignDraft')
  async createDesignDraft(data: {
    productId?: string;
    ringStyle?: string;
    ringShape?: string;
    ringSize?: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    customizationConfig?: string;
    guestSessionId?: string;
  }) {
    return this.designService.createDesignDraft(data);
  }

  @GrpcMethod('EcommerceService', 'GetDesignDraftByCode')
  async getDesignDraftByCode(data: { designCode: string }) {
    return this.designService.getDesignDraftByCode(data.designCode);
  }

  @GrpcMethod('EcommerceService', 'GetMyDrafts')
  async getMyDrafts(data: { guestSessionId: string }) {
    return this.designService.getMyDrafts(data.guestSessionId);
  }

  @GrpcMethod('EcommerceService', 'UpdateDesignDraft')
  async updateDesignDraft(data: {
    id?: string;
    ringStyle?: string;
    ringShape?: string;
    ringSize?: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    customizationConfig?: string;
    guestSessionId?: string;
  }) {
    return this.designService.updateDesignDraft(data);
  }

  @GrpcMethod('EcommerceService', 'ClaimDesignDraft')
  async claimDesignDraft(data: { designCode: string; userId: string }) {
    return this.designService.claimDesignDraft(data.designCode, data.userId);
  }
}
