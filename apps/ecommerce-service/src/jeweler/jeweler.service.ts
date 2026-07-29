import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma';

@Injectable()
export class JewelerService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyPerformance(jewelerId: string, fromDate?: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // today's shift
    const shift = await this.prisma.staff_shifts.findFirst({
      where: { staff_id: jewelerId, shift_date: todayStart },
    });

    // all tasks by this jeweler
    const allTasks = await this.prisma.production_tasks.findMany({
      where: { assigned_jeweler_id: jewelerId },
      include: {
        orders: { select: { order_code: true } },
        qa_checks: { select: { result: true } },
      },
    });

    const completed = allTasks.filter((t) => t.status === 'COMPLETED');
    const completedToday = completed.filter(
      (t) => t.completed_at && t.completed_at >= todayStart,
    ).length;

    // shift tasks
    let completedShift = 0;
    if (shift?.start_time && shift?.end_time) {
      const shiftDate = shift.shift_date!;
      completedShift = completed.filter((t) => {
        if (!t.completed_at) return false;
        const shiftStart = new Date(shiftDate);
        shiftStart.setHours(
          shift.start_time!.getHours(),
          shift.start_time!.getMinutes(),
        );
        const shiftEnd = new Date(shiftDate);
        shiftEnd.setHours(
          shift.end_time!.getHours(),
          shift.end_time!.getMinutes(),
        );
        return t.completed_at >= shiftStart && t.completed_at <= shiftEnd;
      }).length;
    }

    const qaChecks = allTasks.filter((t) => t.qa_checks.length > 0);
    const qaPassed = qaChecks.filter((t) =>
      t.qa_checks.some((q) => q.result === 'PASSED'),
    ).length;

    const durations = completed
      .filter((t) => t.completed_at && t.started_at)
      .map(
        (t) => (t.completed_at!.getTime() - t.started_at!.getTime()) / 3600000,
      );

    // recent tasks
    const recentWhere: any = {
      assigned_jeweler_id: jewelerId,
      status: 'COMPLETED',
    };
    if (fromDate) recentWhere.completed_at = { gte: new Date(fromDate) };
    const recentTasks = await this.prisma.production_tasks.findMany({
      where: recentWhere,
      orderBy: { completed_at: 'desc' },
      take: 20,
      include: {
        orders: { select: { order_code: true } },
        qa_checks: { select: { result: true } },
      },
    });

    return {
      completed_today: completedToday,
      completed_shift: completedShift,
      qa_pass_rate:
        qaChecks.length > 0
          ? Number(((qaPassed / qaChecks.length) * 100).toFixed(1))
          : 0,
      avg_hours:
        durations.length > 0
          ? Number(
              (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(
                1,
              ),
            )
          : 0,
      recent_tasks: recentTasks.map((t) => ({
        id: t.id,
        order_code: t.orders?.order_code ?? '',
        completed_at: t.completed_at?.toISOString() ?? '',
        qa_result: t.qa_checks[0]?.result ?? '',
        duration_hours:
          t.started_at && t.completed_at
            ? Number(
                (
                  (t.completed_at.getTime() - t.started_at.getTime()) /
                  3600000
                ).toFixed(1),
              )
            : 0,
      })),
    };
  }

  async getMyCurrentTask(jewelerId: string) {
    const task = await this.prisma.production_tasks.findFirst({
      where: { assigned_jeweler_id: jewelerId, status: 'IN_PROGRESS' },
      orderBy: { started_at: 'desc' },
      include: {
        orders: {
          select: {
            id: true,
            order_code: true,
            users_orders_user_idTousers: { select: { full_name: true } },
            guest_customers: { select: { full_name: true } },
          },
        },
      },
    });
    if (!task) return {};
    return {
      id: task.id,
      order_id: task.orders?.id ?? '',
      order_code: task.orders?.order_code ?? '',
      status: task.status,
      started_at: task.started_at?.toISOString() ?? '',
      customer_name:
        task.orders?.users_orders_user_idTousers?.full_name ??
        task.orders?.guest_customers?.full_name ??
        '',
    };
  }
}
