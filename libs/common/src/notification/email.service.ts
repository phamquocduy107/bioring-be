import { PrismaService } from '@app/prisma';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SendGrid from '@sendgrid/mail';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_EMAIL_LOGO_URL,
  EMAIL_LOGO_PLACEHOLDER,
} from './templates';

export interface EmailAttachment {
  content: string; // base64
  filename: string;
  type: string;
  disposition?: 'attachment' | 'inline';
}

export interface SendEmailParams {
  to: string;
  type: string;
  subject: string;
  html: string;
  orderId?: string;
  attachments?: EmailAttachment[];
}

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private resolveLogoUrl(): string {
    const fromConfig = this.config.get<string>('EMAIL_LOGO_URL')?.trim();
    return fromConfig || DEFAULT_EMAIL_LOGO_URL;
  }

  private injectAssets(html: string): string {
    return html.split(EMAIL_LOGO_PLACEHOLDER).join(this.resolveLogoUrl());
  }

  async send(data: SendEmailParams): Promise<string | undefined> {
    try {
      const apiKey = this.config.get<string>('SENDGRID_API_KEY');
      if (!apiKey) {
        console.warn('[Email] SENDGRID_API_KEY not configured');
        return;
      }

      const emailId = randomUUID();
      const fromEmail =
        this.config.get<string>('SENDGRID_FROM_EMAIL') ??
        'noreply@bioring.website';

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

      const trackingPixel = `<img src="https://api.bioring.com/api/v1/track/open?id=${emailId}" width="1" height="1" style="display:none" />`;
      const htmlWithAssets = this.injectAssets(data.html) + trackingPixel;

      SendGrid.setApiKey(apiKey);
      await SendGrid.send({
        to: data.to,
        from: fromEmail,
        subject: data.subject,
        html: htmlWithAssets,
        attachments: data.attachments?.map((a) => ({
          content: a.content,
          filename: a.filename,
          type: a.type,
          disposition: a.disposition ?? 'attachment',
        })),
      });

      return emailId;
    } catch (error) {
      console.warn('[Email] Failed to send:', error);
      return;
    }
  }
}
