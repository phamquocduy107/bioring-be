import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS, Webhook, WebhookData } from '@payos/node';

@Injectable()
export class PayOSService {
  private payOS: InstanceType<typeof PayOS>;

  constructor(private readonly configService: ConfigService) {
    this.payOS = new PayOS({
      clientId: this.configService.getOrThrow<string>('PAYOS_CLIENT_ID'),
      apiKey: this.configService.getOrThrow<string>('PAYOS_API_KEY'),
      checksumKey: this.configService.getOrThrow<string>('PAYOS_CHECKSUM_KEY'),
    });
  }

  async createPaymentLink(params: {
    orderCode: number;
    amount: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ paymentUrl: string; transactionId: string; qrCode: string }> {
    try {
      const result = await this.payOS.paymentRequests.create({
        orderCode: params.orderCode,
        amount: params.amount,
        description: params.description,
        returnUrl: params.returnUrl,
        cancelUrl: params.cancelUrl,
      });
      console.log(`[PayOS] createPaymentLink success: orderCode=${params.orderCode}, paymentLinkId=${result.paymentLinkId}`);

      return {
        paymentUrl: result.checkoutUrl,
        transactionId: result.paymentLinkId,
        qrCode: result.qrCode,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown PayOS error';
      console.error(`[PayOS] createPaymentLink failed: ${msg}`);
      throw new HttpException(`PayOS createPaymentLink error: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  async verifyWebhook(webhook: Webhook): Promise<WebhookData | null> {
    try {
      const data = await this.payOS.webhooks.verify(webhook);
      return data as unknown as WebhookData;
    } catch {
      return null;
    }
  }

  async cancelPaymentLink(transactionId: string): Promise<void> {
    try {
      await this.payOS.paymentRequests.cancel(transactionId);
      console.log(`[PayOS] cancelPaymentLink success: transactionId=${transactionId}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown PayOS error';
      console.error(`[PayOS] cancelPaymentLink failed: ${msg}`);
      throw new HttpException(`PayOS cancel error: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  async getTransactionStatus(orderCode: string): Promise<{ status: string }> {
    try {
      const result = await this.payOS.paymentRequests.get(Number(orderCode));
      return { status: result.status };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown PayOS error';
      console.error(`[PayOS] getTransactionStatus failed: ${msg}`);
      throw new HttpException(`PayOS getTransactionStatus error: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }
}
