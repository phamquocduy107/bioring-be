import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  private map(a: Record<string, any>) {
    return {
      id: a.id,
      userId: a.user_id,
      recipientName: a.recipient_name ?? '',
      phone: a.phone_number ?? '',
      fullAddress: a.full_address ?? '',
      ward: a.ward ?? '',
      district: a.district ?? '',
      province: a.province ?? '',
      isDefault: a.is_default ?? false,
      createdAt: a.created_at?.toISOString?.() ?? '',
      updatedAt: a.updated_at?.toISOString?.() ?? '',
    };
  }

  async list(userId: string) {
    const addresses = await this.prisma.user_addresses.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
    return addresses.map(a => this.map(a));
  }

  async create(
    userId: string,
    data: {
      recipientName: string;
      phone: string;
      fullAddress: string;
      ward?: string;
      district?: string;
      province?: string;
      isDefault?: boolean;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.user_addresses.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false },
        });
      }
      const a = await tx.user_addresses.create({
        data: {
          id: randomUUID(),
          user_id: userId,
          recipient_name: data.recipientName,
          phone_number: data.phone,
          full_address: data.fullAddress,
          ward: data.ward,
          district: data.district,
          province: data.province,
          is_default: data.isDefault ?? false,
        },
      });
      return this.map(a);
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      recipientName?: string;
      phone?: string;
      fullAddress?: string;
      ward?: string;
      district?: string;
      province?: string;
      isDefault?: boolean;
    },
  ) {
    const address = await this.prisma.user_addresses.findUnique({
      where: { id },
    });
    if (!address) throw new NotFoundException('Address not found');
    if (address.user_id !== userId)
      throw new ForbiddenException('Not your address');

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.user_addresses.updateMany({
          where: { user_id: userId, is_default: true, id: { not: id } },
          data: { is_default: false },
        });
      }
      const a = await tx.user_addresses.update({
        where: { id },
        data: {
          ...(data.recipientName !== undefined && {
            recipient_name: data.recipientName,
          }),
          ...(data.phone !== undefined && { phone_number: data.phone }),
          ...(data.fullAddress !== undefined && {
            full_address: data.fullAddress,
          }),
          ...(data.ward !== undefined && { ward: data.ward }),
          ...(data.district !== undefined && { district: data.district }),
          ...(data.province !== undefined && { province: data.province }),
          ...(data.isDefault !== undefined && { is_default: data.isDefault }),
        },
      });
      return this.map(a);
    });
  }

  async delete(id: string, userId: string) {
    const address = await this.prisma.user_addresses.findUnique({
      where: { id },
    });
    if (!address) throw new NotFoundException('Address not found');
    if (address.user_id !== userId)
      throw new ForbiddenException('Not your address');

    await this.prisma.user_addresses.delete({ where: { id } });
    return { success: true };
  }
}
