import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async listDevices(params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    const where: Prisma.iot_devicesWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { device_name: { contains: params.search } },
        { mac_address: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.iot_devices.findMany({
        where,
        include: {
          device_health_logs: { orderBy: { logged_at: 'desc' }, take: 1 },
        },
        orderBy: { updated_at: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.iot_devices.count({ where }),
    ]);

    return {
      data: data.map((d) => ({
        id: d.id,
        serial_number: d.mac_address ?? '',
        model: d.device_type ?? '',
        status: d.status ?? '',
        firmware: d.firmware_version ?? '',
        last_seen: d.updated_at?.toISOString() ?? '',
        rssi: null as number | null,
        uptime: null as number | null,
        cpu: d.device_health_logs[0]?.cpu_usage
          ? Number(d.device_health_logs[0].cpu_usage)
          : null,
        memory: d.device_health_logs[0]?.memory_usage
          ? Number(d.device_health_logs[0].memory_usage)
          : null,
      })),
      total,
      page: params.page,
      limit: params.limit,
      last_page: Math.ceil(total / params.limit),
    };
  }

  async getDevice(id: string) {
    const d = await this.prisma.iot_devices.findUnique({
      where: { id },
      include: {
        device_health_logs: { orderBy: { logged_at: 'desc' }, take: 1 },
      },
    });
    if (!d) throw new NotFoundException('Device not found');
    return {
      device: {
        id: d.id,
        serial_number: d.mac_address ?? '',
        model: d.device_type ?? '',
        status: d.status ?? '',
        firmware: d.firmware_version ?? '',
        last_seen: d.updated_at?.toISOString() ?? '',
        rssi: null as number | null,
        uptime: null as number | null,
        cpu: d.device_health_logs[0]?.cpu_usage
          ? Number(d.device_health_logs[0].cpu_usage)
          : null,
        memory: d.device_health_logs[0]?.memory_usage
          ? Number(d.device_health_logs[0].memory_usage)
          : null,
      },
    };
  }

  async createDevice(data: {
    device_name: string;
    mac_address: string;
    device_type: string;
  }) {
    const d = await this.prisma.iot_devices.create({
      data: {
        id: randomUUID(),
        device_name: data.device_name,
        mac_address: data.mac_address,
        device_type: data.device_type,
        status: 'OFFLINE',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return {
      device: {
        id: d.id,
        serial_number: d.mac_address ?? '',
        model: d.device_type ?? '',
        status: d.status ?? '',
        firmware: d.firmware_version ?? '',
        last_seen: d.updated_at?.toISOString() ?? '',
        rssi: null as number | null,
        uptime: null as number | null,
        cpu: null as number | null,
        memory: null as number | null,
      },
    };
  }

  async deleteDevice(id: string) {
    const existing = await this.prisma.iot_devices.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Device not found');
    await this.prisma.iot_devices.delete({ where: { id } });
    return { success: true };
  }

  async updateDevice(data: {
    id: string;
    device_name?: string;
    device_type?: string;
    status?: string;
    firmware_version?: string;
  }) {
    const existing = await this.prisma.iot_devices.findUnique({
      where: { id: data.id },
    });
    if (!existing) throw new NotFoundException('Device not found');

    const d = await this.prisma.iot_devices.update({
      where: { id: data.id },
      data: {
        ...(data.device_name !== undefined && {
          device_name: data.device_name,
        }),
        ...(data.device_type !== undefined && {
          device_type: data.device_type,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.firmware_version !== undefined && {
          firmware_version: data.firmware_version,
        }),
        updated_at: new Date(),
      },
      include: {
        device_health_logs: { orderBy: { logged_at: 'desc' }, take: 1 },
      },
    });

    return {
      device: {
        id: d.id,
        serial_number: d.mac_address ?? '',
        model: d.device_type ?? '',
        status: d.status ?? '',
        firmware: d.firmware_version ?? '',
        last_seen: d.updated_at?.toISOString() ?? '',
        rssi: null as number | null,
        uptime: null as number | null,
        cpu: d.device_health_logs[0]?.cpu_usage
          ? Number(d.device_health_logs[0].cpu_usage)
          : null,
        memory: d.device_health_logs[0]?.memory_usage
          ? Number(d.device_health_logs[0].memory_usage)
          : null,
      },
    };
  }
}
