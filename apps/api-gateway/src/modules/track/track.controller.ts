import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '@app/common';
import { PrismaService } from '@app/prisma';

@Controller('api/v1/track')
export class TrackController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('open')
  @Public()
  async trackOpen(@Query('id') emailId: string, @Res() res: Response) {
    if (emailId) {
      await this.prisma.email_trackings.update({
        where: { email_id: emailId },
        data: {
          opened_at: new Date(),
          open_count: { increment: 1 },
        },
      });
    }

    // 1x1 transparent GIF pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64',
    );
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.send(pixel);
  }
}
