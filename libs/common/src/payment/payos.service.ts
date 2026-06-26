import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PayOSService {
  private readonly apiUrl = 'https://api-merchant.payos.vn';
  private readonly clientId: string;
  private readonly apiKey: string;
  private readonly checksumKey: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('PAYOS_CLIENT_ID');
    this.apiKey = this.configService.getOrThrow<string>('PAYOS_API_KEY');
    this.checksumKey =
      this.configService.getOrThrow<string>('PAYOS_CHECKSUM_KEY');
  }

  async createPaymentLink(params: {
    orderCode: string;
    amount: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ paymentUrl: string; transactionId: string; qrCode: string }> {
    try {
      const { createHmac } = await import('node:crypto');
      const signData = [
        `amount=${params.amount}`,
        `cancelUrl=${params.cancelUrl}`,
        `description=${params.description}`,
        `orderCode=${params.orderCode}`,
        `returnUrl=${params.returnUrl}`,
      ].join('&');
      const signature = createHmac('sha256', this.checksumKey)
        .update(signData)
        .digest('hex');

      const body = {
        orderCode: params.orderCode,
        amount: params.amount,
        description: params.description,
        returnUrl: params.returnUrl,
        cancelUrl: params.cancelUrl,
        signature,
      };

      const response = await fetch(`${this.apiUrl}/v2/payment-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new HttpException(
          `PayOS API error: ${err}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const json = (await response.json()) as {
        data: { checkoutUrl: string; id: string; qrCode: string };
      };
      return {
        paymentUrl: json.data.checkoutUrl,
        transactionId: json.data.id,
        qrCode: json.data.qrCode,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `PayOS connection failed: ${(error as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  verifyWebhook(payload: {
    signature: string;
    data?: string;
    [key: string]: unknown;
  }): boolean {
    const { createHmac } = require('node:crypto');
    const dataToSign = payload.data ?? JSON.stringify(payload);
    const computed = createHmac('sha256', this.checksumKey)
      .update(dataToSign)
      .digest('hex');
    return computed === payload.signature;
  }

  async cancelPaymentLink(transactionId: string): Promise<void> {
    const response = await fetch(
      `${this.apiUrl}/v2/payment-requests/${transactionId}/cancel`,
      {
        method: 'PUT',
        headers: {
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey,
        },
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new HttpException(
        `PayOS cancel error: ${err}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getTransactionStatus(
    transactionId: string,
  ): Promise<{ status: string }> {
    const response = await fetch(
      `${this.apiUrl}/v2/payment-requests/${transactionId}`,
      {
        headers: {
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey,
        },
      },
    );

    if (!response.ok) {
      throw new HttpException(
        'Failed to get PayOS transaction status',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const json = (await response.json()) as { data: { status: string } };
    return { status: json.data.status };
  }
}
