import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@app/prisma';
import SendGrid from '@sendgrid/mail';
import { randomUUID } from 'node:crypto';

export interface SendEmailParams {
  to: string;
  type: string;
  subject: string;
  html: string;
  orderId?: string;
}

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async send(data: SendEmailParams): Promise<string | undefined> {
    try {
      const apiKey = this.config.get<string>('SENDGRID_API_KEY');
      if (!apiKey) {
        console.warn('[Email] SENDGRID_API_KEY not configured');
        return;
      }

      const emailId = randomUUID();
      const fromEmail =
        this.config.get<string>('SENDGRID_FROM_EMAIL') ?? 'noreply@bioring.vn';

      // ponytail: ghi tracking trước, không block nếu send fail
      await this.prisma.email_trackings
        .create({
          data: {
            id: randomUUID(),
            email_id: emailId,
            email_to: data.to,
            email_type: data.type,
            order_id: data.orderId,
            sent_at: new Date(),
          },
        })
        .catch((err: unknown) =>
          console.warn('[Email] Failed to save tracking:', err),
        );

      // Append tracking pixel
      const trackingPixel = `<img src="https://api.bioring.com/api/v1/track/open?id=${emailId}" width="1" height="1" style="display:none" />`;
      const htmlWithTracking = data.html + trackingPixel;

      SendGrid.setApiKey(apiKey);
      await SendGrid.send({
        to: data.to,
        from: fromEmail,
        subject: data.subject,
        html: htmlWithTracking,
      });

      return emailId;
    } catch (error) {
      // ponytail: fail silently, không crash service
      console.warn('[Email] Failed to send:', error);
      return;
    }
  }
}
