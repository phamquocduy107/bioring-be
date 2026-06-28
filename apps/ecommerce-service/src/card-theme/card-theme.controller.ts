import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CardThemeService } from './card-theme.service';

@Controller()
export class CardThemeController {
  constructor(private readonly cardThemeService: CardThemeService) {}

  @GrpcMethod('EcommerceService', 'GetCardThemes')
  async getCardThemes(data: { page?: number; limit?: number }) {
    return this.cardThemeService.findAll(data.page ?? 1, data.limit ?? 10);
  }

  @GrpcMethod('EcommerceService', 'GetCardTheme')
  async getCardTheme(data: { id: string }) {
    return this.cardThemeService.findById(data.id);
  }

  @GrpcMethod('EcommerceService', 'CreateCardTheme')
  async createCardTheme(data: {
    themeCode: string;
    name: string;
    defaultBgUrl?: string;
    styleConfig?: string;
  }) {
    return this.cardThemeService.create(data);
  }

  @GrpcMethod('EcommerceService', 'UpdateCardTheme')
  async updateCardTheme(data: {
    id: string;
    themeCode?: string;
    name?: string;
    defaultBgUrl?: string;
    styleConfig?: string;
  }) {
    return this.cardThemeService.update(data);
  }

  @GrpcMethod('EcommerceService', 'DeleteCardTheme')
  async deleteCardTheme(data: { id: string }) {
    return this.cardThemeService.delete(data.id);
  }
}
