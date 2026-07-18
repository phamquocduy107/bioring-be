import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { randomUUID } from 'node:crypto';
import { DEFAULT_PAYOS_LINK_TTL_MS } from '@app/common';

@Injectable()
export class WarrantyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payOS: PayOSService,
  ) {}

  async createClaim(data: {
    warrantyId: string;
    orderId: string;
    serviceType: string;
    issueDescription: string;
    proofImages: string[];
    proofVideos: string[];
    userId: string;
  }) {
    const warranty = await this.prisma.warranties.findUnique({
      where: { id: data.warrantyId },
    });
    if (!warranty) throw new NotFoundException('Warranty not found');
    if (warranty.order_id !== data.orderId) throw new BadRequestException('Warranty does not belong to this order');

    const order = await this.prisma.orders.findUnique({
      where: { id: data.orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.user_id !== data.userId) throw new ForbiddenException('Order does not belong to this user');

    const claimCode = await this.generateClaimCode();

    const claim = await this.prisma.warranty_claims.create({
      data: {
        id: randomUUID(),
        claim_code: claimCode,
        warranty_id: data.warrantyId,
        order_id: data.orderId,
        engraving_id: order.engraving_id,
        requested_by_user_id: data.userId,
        service_type: data.serviceType,
        issue_description: data.issueDescription,
        proof_images: data.proofImages,
        proof_videos: data.proofVideos,
        status: 'PENDING_REVIEW',
      },
    });

    await this.prisma.service_tickets.create({
      data: {
        id: randomUUID(),
        ticket_code: await this.generateTicketCode(),
        warranty_claim_id: claim.id,
        service_type: data.serviceType,
        description: data.issueDescription,
        status: 'PENDING',
      },
    });

    return { claim: await this.getClaimFull(claim.id) };
  }

  async createClaimByLookup(data: {
    orderCode: string;
    serviceType: string;
    issueDescription: string;
    proofImages: string[];
    proofVideos: string[];
  }) {
    const order = await this.prisma.orders.findFirst({
      where: { order_code: data.orderCode },
      include: { warranties: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const warranty = order.warranties?.[0];
    if (!warranty) throw new NotFoundException('No warranty found for this order');

    const claimCode = await this.generateClaimCode();

    const claim = await this.prisma.warranty_claims.create({
      data: {
        id: randomUUID(),
        claim_code: claimCode,
        warranty_id: warranty.id,
        order_id: order.id,
        engraving_id: order.engraving_id,
        guest_customer_id: order.guest_customer_id,
        service_type: data.serviceType,
        issue_description: data.issueDescription,
        proof_images: data.proofImages,
        proof_videos: data.proofVideos,
        status: 'PENDING_REVIEW',
      },
    });

    await this.prisma.service_tickets.create({
      data: {
        id: randomUUID(),
        ticket_code: await this.generateTicketCode(),
        warranty_claim_id: claim.id,
        service_type: data.serviceType,
        description: data.issueDescription,
        status: 'PENDING',
      },
    });

    return { claim: await this.getClaimFull(claim.id) };
  }

  async getClaim(id: string) {
    const claim = await this.getClaimFull(id);
    if (!claim) throw new NotFoundException('Claim not found');
    return { claim };
  }

  async getMyClaims(userId: string, page: number, limit: number, viewAll?: boolean) {
    const skip = (page - 1) * limit;
    const where = viewAll ? {} : { requested_by_user_id: userId };
    const [data, total] = await Promise.all([
      this.prisma.warranty_claims.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { service_tickets: true },
      }),
      this.prisma.warranty_claims.count({ where }),
    ]);

    return {
      data: (data ?? []).map((c) => this.mapClaim(c)),
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit) || 0,
    };
  }

  async reviewClaim(
    id: string,
    action: string,
    extraFee: number,
    managerNote: string,
    managerId: string,
  ) {
    const claim = await this.prisma.warranty_claims.findUnique({
      where: { id },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== 'PENDING_REVIEW') throw new BadRequestException('Claim must be PENDING_REVIEW');

    const updateData: Record<string, unknown> = { manager_id: managerId };

    if (action === 'approve') {
      updateData.status = 'PENDING_RECEIVE';
      updateData.charge_status = 'FREE';
    } else if (action === 'quotation') {
      if (!extraFee || extraFee <= 0) throw new BadRequestException('extraFee required for quotation');
      updateData.status = 'QUOTATION_SENT';
      updateData.extra_fee = extraFee;
      updateData.charge_status = 'PAID';
    } else if (action === 'reject') {
      updateData.status = 'REJECTED';
    } else {
      throw new BadRequestException('action must be approve, quotation, or reject');
    }

    if (managerNote) updateData.manager_note = managerNote;

    await this.prisma.warranty_claims.update({
      where: { id },
      data: updateData,
    });

    return { claim: await this.getClaimFull(id) };
  }

  async confirmClaim(id: string, userId: string) {
    const claim = await this.prisma.warranty_claims.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.requested_by_user_id !== userId) throw new ForbiddenException('Not your claim');
    if (claim.status !== 'QUOTATION_SENT') throw new BadRequestException('Claim must be QUOTATION_SENT');

    const hasFee = Number(claim.extra_fee ?? 0) > 0;
    await this.prisma.warranty_claims.update({
      where: { id },
      data: {
        customer_confirmed_at: new Date(),
        status: hasFee ? 'AWAITING_PAYMENT' : 'PENDING_RECEIVE',
      },
    });

    return { claim: await this.getClaimFull(id) };
  }

  async initiateClaimPayment(
    claimId: string,
    userId: string,
    returnUrl: string,
    cancelUrl: string,
  ) {
    const claim = await this.prisma.warranty_claims.findUnique({ where: { id: claimId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.requested_by_user_id !== userId) throw new ForbiddenException('Not your claim');
    if (claim.status !== 'AWAITING_PAYMENT') throw new BadRequestException('Claim not awaiting payment');

    const amount = Number(claim.extra_fee ?? 0);
    if (amount <= 0) throw new BadRequestException('No extra fee to pay');

    const payosOrderCode = Number(`${Date.now()}${Math.floor(Math.random() * 100)}`);
    const result = await this.payOS.createPaymentLink({
      orderCode: payosOrderCode,
      amount,
      description: `Service fee - ${claim.claim_code}`,
      returnUrl,
      cancelUrl,
    });

    const payment = await this.prisma.payments.create({
      data: {
        id: randomUUID(),
        warranty_claim_id: claimId,
        payment_code: String(payosOrderCode),
        payment_phase: 'EXTRA_FEE',
        amount,
        method: 'PAYOS',
        status: 'PENDING',
        payos_transaction_id: result.transactionId,
        qr_code: result.qrCode,
        payment_url: result.paymentUrl,
      },
    });

    return {
      payment: {
        id: payment.id,
        orderId: payment.order_id ?? '',
        paymentPhase: payment.payment_phase ?? '',
        amount: Number(payment.amount),
        method: payment.method ?? '',
        status: payment.status ?? '',
        payosTransactionId: payment.payos_transaction_id ?? '',
        paymentUrl: payment.payment_url ?? '',
        paidAt: payment.paid_at?.toISOString() ?? '',
        createdAt: payment.created_at?.toISOString() ?? '',
      },
      paymentUrl: result.paymentUrl,
    };
  }

  async receiveServiceTicket(claimId: string, data: {
    conditionNote: string;
    receivedImages: string[];
    jewelerId: string;
    staffId: string;
  }) {
    const claim = await this.prisma.warranty_claims.findUnique({
      where: { id: claimId },
      include: { service_tickets: { orderBy: { created_at: 'desc' }, take: 1 } },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (!['PENDING_RECEIVE', 'APPROVED'].includes(claim.status ?? '')) {
      throw new BadRequestException('Claim must be PENDING_RECEIVE or APPROVED');
    }

    const ticket = claim.service_tickets?.[0];
    if (!ticket) throw new NotFoundException('No service ticket found');

    const jeweler = await this.prisma.users.findUnique({
      where: { id: data.jewelerId },
    });
    if (!jeweler) throw new NotFoundException('Jeweler not found');

    await this.prisma.$transaction([
      this.prisma.service_tickets.update({
        where: { id: ticket.id },
        data: {
          status: 'RECEIVED',
          assigned_staff_id: data.staffId,
          assigned_jeweler_id: data.jewelerId,
          description: data.conditionNote || ticket.description,
          received_product_at: new Date(),
          service_started_at: new Date(),
        },
      }),
      this.prisma.warranty_claims.update({
        where: { id: claimId },
        data: { status: 'IN_SERVICE' },
      }),
      this.prisma.staff_assignments.create({
        data: {
          id: randomUUID(),
          staff_id: data.jewelerId,
          warranty_claim_id: claimId,
          assignment_type: 'SERVICE',
          status: 'ASSIGNED',
          assigned_at: new Date(),
        },
      }),
    ]);

    return { claim: await this.getClaimFull(claimId) };
  }

  async completeServiceTicket(claimId: string, data: {
    resultNote: string;
    costUpdate: number;
    jewelerId: string;
  }) {
    const claim = await this.prisma.warranty_claims.findUnique({
      where: { id: claimId },
      include: { service_tickets: { where: { status: 'RECEIVED' }, take: 1 } },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== 'IN_SERVICE') throw new BadRequestException('Claim must be IN_SERVICE');

    const ticket = claim.service_tickets?.[0];
    if (!ticket) throw new NotFoundException('No active service ticket');

    await this.prisma.service_tickets.update({
      where: { id: ticket.id },
      data: {
        status: 'COMPLETED',
        result_note: data.resultNote,
        cost_update: data.costUpdate,
        service_completed_at: new Date(),
      },
    });

    return { claim: await this.getClaimFull(claimId) };
  }

  async returnClaim(id: string, staffId: string) {
    const claim = await this.prisma.warranty_claims.findUnique({
      where: { id },
      include: { service_tickets: { where: { status: 'COMPLETED' }, take: 1 } },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== 'IN_SERVICE') throw new BadRequestException('Claim must be IN_SERVICE');

    if (!claim.service_tickets?.[0]) throw new BadRequestException('Service ticket not completed yet');

    await this.prisma.warranty_claims.update({
      where: { id },
      data: { status: 'COMPLETED', updated_at: new Date() },
    });

    return { claim: await this.getClaimFull(id) };
  }

  private async generateClaimCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = 'WCL-';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (await this.prisma.warranty_claims.findUnique({ where: { claim_code: code } }));
    return code;
  }

  private async generateTicketCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = 'SVT-';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (await this.prisma.service_tickets.findUnique({ where: { ticket_code: code } }));
    return code;
  }

  private async getClaimFull(claimId: string) {
    const claim = await this.prisma.warranty_claims.findUnique({
      where: { id: claimId },
      include: { service_tickets: true, payments: true },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return this.mapClaim(claim);
  }

  private mapClaim(claim: unknown): unknown {
    const c = claim as Record<string, unknown>;
    const tickets = (c.service_tickets as unknown[]) ?? [];
    const payments = (c.payments as unknown[]) ?? [];
    return {
      payments: payments.map((p: unknown) => {
        const pm = p as Record<string, unknown>;
        return {
          id: pm.id,
          orderId: pm.order_id ?? '',
          paymentPhase: pm.payment_phase ?? '',
          amount: Number(pm.amount ?? 0),
          method: pm.method ?? '',
          status: pm.status ?? '',
          payosTransactionId: pm.payos_transaction_id ?? '',
          paymentUrl: pm.payment_url ?? '',
          paidAt: (pm.paid_at as Date)?.toISOString() ?? '',
          createdAt: (pm.created_at as Date)?.toISOString() ?? '',
        };
      }),
      id: c.id,
      claimCode: c.claim_code ?? '',
      warrantyId: c.warranty_id ?? '',
      orderId: c.order_id ?? '',
      engravingId: c.engraving_id ?? '',
      serviceType: c.service_type ?? '',
      issueDescription: c.issue_description ?? '',
      proofImages: c.proof_images ?? [],
      status: c.status ?? '',
      chargeStatus: c.charge_status ?? '',
      extraFee: Number(c.extra_fee ?? 0),
      managerNote: c.manager_note ?? '',
      customerConfirmedAt: (c.customer_confirmed_at as Date)?.toISOString() ?? '',
      createdAt: (c.created_at as Date)?.toISOString() ?? '',
      updatedAt: (c.updated_at as Date)?.toISOString() ?? '',
      serviceTickets: tickets.map((t: unknown) => {
        const tk = t as Record<string, unknown>;
        return {
          id: tk.id,
          ticketCode: tk.ticket_code ?? '',
          warrantyClaimId: tk.warranty_claim_id ?? '',
          assignedStaffId: tk.assigned_staff_id ?? '',
          assignedJewelerId: tk.assigned_jeweler_id ?? '',
          assignedJewelerName: '',
          status: tk.status ?? '',
          receivedProductAt: (tk.received_product_at as Date)?.toISOString() ?? '',
          serviceCompletedAt: (tk.service_completed_at as Date)?.toISOString() ?? '',
          resultNote: tk.result_note ?? '',
          costUpdate: Number(tk.cost_update ?? 0),
        };
      }),
    };
  }
}
