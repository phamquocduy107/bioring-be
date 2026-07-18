import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CaptureSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(data: {
    orderId: string;
    staffId: string;
    deviceId?: string;
  }) {
    const order = await this.prisma.orders.findUnique({
      where: { id: data.orderId },
      select: {
        id: true,
        engraving_id: true,
        user_id: true,
        guest_customer_id: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const session = await this.prisma.biometric_capture_sessions.create({
      data: {
        id: randomUUID(),
        order_id: data.orderId,
        engraving_id: order.engraving_id,
        customer_id: order.user_id,
        guest_customer_id: order.guest_customer_id,
        staff_id: data.staffId,
        device_id: data.deviceId,
        status: 'IN_PROGRESS',
        started_at: new Date(),
      },
    });

    return { session: this.mapSession(session) };
  }

  async completeSession(
    id: string,
    data: {
      qualityScore?: number;
      staffNote?: string;
    },
  ) {
    const existing = await this.prisma.biometric_capture_sessions.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Capture session not found');

    const updated = await this.prisma.biometric_capture_sessions.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        quality_score: data.qualityScore,
        staff_note: data.staffNote,
        completed_at: new Date(),
      },
    });

    return { session: this.mapSession(updated) };
  }

  async getSessions(query: { orderId?: string }) {
    const where: any = {};
    if (query.orderId) where.order_id = query.orderId;

    const sessions = await this.prisma.biometric_capture_sessions.findMany({
      where,
      take: 50,
    });

    return {
      data: sessions.map((s) => this.mapSession(s)),
    };
  }

  async getSession(id: string) {
    const session = await this.prisma.biometric_capture_sessions.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException('Capture session not found');

    return { session: this.mapSession(session) };
  }

  private mapSession(session: any) {
    return {
      id: session.id,
      orderId: session.order_id,
      engravingId: session.engraving_id ?? '',
      customerId: session.customer_id ?? '',
      guestCustomerId: session.guest_customer_id ?? '',
      staffId: session.staff_id ?? '',
      deviceId: session.device_id ?? '',
      status: session.status ?? '',
      qualityScore: Number(session.quality_score ?? 0),
      staffNote: session.staff_note ?? '',
      startedAt: session.started_at?.toISOString() ?? '',
      completedAt: session.completed_at?.toISOString() ?? '',
    };
  }
}
