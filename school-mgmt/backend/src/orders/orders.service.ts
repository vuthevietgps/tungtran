import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/schemas/audit-log.schema';
import { EnrollmentService, EnrollmentResult } from './enrollment.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private auditLogService: AuditLogService,
    private enrollmentService: EnrollmentService,
  ) {}

  private async generateOrderCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;
    const last = await this.orderModel
      .findOne({ orderCode: { $regex: `^${prefix}` } })
      .sort({ orderCode: -1 })
      .lean();
    let nextNum = 1;
    if (last) {
      const parts = last.orderCode.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  async create(dto: CreateOrderDto, user: any): Promise<Order> {
    const orderCode = await this.generateOrderCode();

    // Resolve adGroupId: Lead takes priority over direct assignment
    let adGroupId = dto.adGroupId;
    let adGroupName = dto.adGroupName;
    if (dto.leadId) {
      const lead = await this.leadModel.findById(dto.leadId).lean();
      if (lead?.adGroupId) {
        adGroupId = lead.adGroupId.toString();
        adGroupName = (lead as any).adGroupName || adGroupName;
      }
    }

    const order = new this.orderModel({
      ...dto,
      orderCode,
      status: OrderStatus.DRAFT,
      saleId: user.userId,
      saleName: user.fullName || user.email,
      adGroupId,
      adGroupName,
    });
    const saved = await order.save();

    await this.auditLogService.log({
      userId: user.userId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'ORDERS' as any,
      targetId: saved._id?.toString(),
      targetName: saved.orderCode,
      description: `Tạo đơn đăng ký: ${saved.orderCode} - ${saved.studentName}`,
    });

    return saved;
  }

  async findAll(query: QueryOrderDto, user: any) {
    const filter: FilterQuery<OrderDocument> = {};

    if (query.status) filter.status = query.status;
    if (query.orderType) filter.orderType = query.orderType;
    if (query.saleId) filter.saleId = query.saleId;

    if (query.search) {
      filter.$or = [
        { parentName: { $regex: query.search, $options: 'i' } },
        { parentPhone: { $regex: query.search, $options: 'i' } },
        { studentName: { $regex: query.search, $options: 'i' } },
        { orderCode: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate + 'T23:59:59.999Z');
    }

    // SALE only sees their own orders
    if (user.role === 'SALE') {
      filter.saleId = user.userId;
    }

    return this.orderModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    return order as Order;
  }

  async update(id: string, dto: UpdateOrderDto, user: any): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.NEEDS_INFO].includes(o.status)) {
      throw new BadRequestException('Chỉ có thể sửa đơn ở trạng thái Nháp hoặc Cần bổ sung');
    }

    const updated = await this.orderModel.findByIdAndUpdate(id, dto, { new: true }).lean();

    await this.auditLogService.log({
      userId: user.userId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.UPDATE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Cập nhật đơn ${o.orderCode}`,
      newValue: dto as any,
    });

    return updated as Order;
  }

  async submit(id: string, user: any): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.NEEDS_INFO].includes(o.status)) {
      throw new BadRequestException('Chỉ có thể gửi duyệt đơn ở trạng thái Nháp hoặc Cần bổ sung');
    }

    if (!o.items || o.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải có ít nhất 1 sản phẩm');
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id, { status: OrderStatus.SUBMITTED }, { new: true },
    ).lean();

    await this.auditLogService.log({
      userId: user.userId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.STATUS_CHANGE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Gửi duyệt đơn ${o.orderCode}`,
    });

    return updated as Order;
  }

  async approve(id: string, user: any): Promise<{ order: Order; enrollment: EnrollmentResult }> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException('Chỉ có thể duyệt đơn đang chờ duyệt');
    }

    // Đánh dấu APPROVED trước
    await this.orderModel.findByIdAndUpdate(
      id,
      {
        status: OrderStatus.APPROVED,
        approvedBy: user.userId,
        approvedAt: new Date(),
      },
      { new: true },
    );

    // Audit log duyệt đơn
    await this.auditLogService.log({
      userId: user.userId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.APPROVE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Duyệt đơn ${o.orderCode} - ${o.studentName}`,
    });

    // Auto-enrollment: tạo Student, Invoice, ghi log
    const enrollment = await this.enrollmentService.processApprovedOrder(id, user);

    // Lấy lại order sau khi enrollment cập nhật
    const updatedOrder = await this.orderModel.findById(id).lean();

    return {
      order: updatedOrder as Order,
      enrollment,
    };
  }

  async reject(id: string, reason: string, user: any): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException('Chỉ có thể từ chối đơn đang chờ duyệt');
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      { status: OrderStatus.REJECTED, rejectionReason: reason },
      { new: true },
    ).lean();

    await this.auditLogService.log({
      userId: user.userId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.REJECT, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Từ chối đơn ${o.orderCode}: ${reason}`,
    });

    return updated as Order;
  }

  async requestInfo(id: string, reason: string, user: any): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException('Chỉ yêu cầu bổ sung cho đơn đang chờ duyệt');
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      { status: OrderStatus.NEEDS_INFO, needsInfoReason: reason },
      { new: true },
    ).lean();

    return updated as Order;
  }

  async cancel(id: string, user: any): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const o = order as any;
    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(o.status)) {
      throw new BadRequestException('Không thể hủy đơn đã hoàn tất hoặc đã hủy');
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id, { status: OrderStatus.CANCELLED }, { new: true },
    ).lean();

    await this.auditLogService.log({
      userId: user.userId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.STATUS_CHANGE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Hủy đơn ${o.orderCode}`,
    });

    return updated as Order;
  }

  async getPipeline(user: any) {
    const match: any = {};
    if (user.role === 'SALE') match.saleId = user.userId;

    const pipeline = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$finalAmount' },
        },
      },
    ]);

    const result: Record<string, { count: number; totalValue: number }> = {};
    for (const status of Object.values(OrderStatus)) {
      result[status] = { count: 0, totalValue: 0 };
    }
    for (const item of pipeline) {
      result[item._id] = { count: item.count, totalValue: item.totalValue || 0 };
    }

    return result;
  }

  async getStats(user: any) {
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const stats = await this.orderModel.aggregate([
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                approved: { $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'COMPLETED']] }, 1, 0] } },
                totalRevenue: {
                  $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'COMPLETED']] }, '$finalAmount', 0] },
                },
                totalCommission: {
                  $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'COMPLETED']] }, '$saleCommission', 0] },
                },
              },
            },
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                revenue: {
                  $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'COMPLETED']] }, '$finalAmount', 0] },
                },
              },
            },
          ],
          bySale: [
            {
              $group: {
                _id: { saleId: '$saleId', saleName: '$saleName' },
                total: { $sum: 1 },
                approved: { $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'COMPLETED']] }, 1, 0] } },
                revenue: {
                  $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'COMPLETED']] }, '$finalAmount', 0] },
                },
              },
            },
          ],
          byType: [{ $group: { _id: '$orderType', count: { $sum: 1 } } }],
          bySource: [
            { $match: { leadSource: { $ne: null } } },
            { $group: { _id: '$leadSource', count: { $sum: 1 } } },
          ],
          pendingValue: [
            { $match: { status: 'SUBMITTED' } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
        },
      },
    ]);

    const data = stats[0];
    const overview = data.overview[0] || { total: 0, approved: 0, totalRevenue: 0, totalCommission: 0 };

    return {
      total: overview.total,
      approved: overview.approved,
      conversionRate: overview.total > 0 ? Math.round((overview.approved / overview.total) * 100) : 0,
      totalRevenue: overview.totalRevenue,
      totalCommission: overview.totalCommission,
      thisMonth: data.thisMonth[0] || { count: 0, revenue: 0 },
      bySale: data.bySale.map((s: any) => ({
        saleId: s._id.saleId,
        saleName: s._id.saleName,
        total: s.total,
        approved: s.approved,
        conversionRate: s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0,
        revenue: s.revenue,
      })),
      byType: data.byType,
      bySource: data.bySource,
      pendingOrders: data.pendingValue[0]?.count || 0,
      pendingValue: data.pendingValue[0]?.total || 0,
    };
  }

  async remove(id: string, user: any): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.CANCELLED].includes(o.status)) {
      throw new BadRequestException('Chỉ có thể xóa đơn Nháp hoặc Đã hủy');
    }

    await this.orderModel.findByIdAndDelete(id);

    await this.auditLogService.log({
      userId: user.userId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.DELETE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Xóa đơn ${o.orderCode}`,
    });

    return order as Order;
  }

  // ════════════════════════════════════════════════════════════════════
  // COMMISSION REPORT (Phase 1.3)
  // ════════════════════════════════════════════════════════════════════

  async getCommissionReport(saleId?: string, fromDate?: string, toDate?: string) {
    const filter: any = {};
    if (saleId) filter.saleId = saleId;
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const orders = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Detail list
    const details = orders.map((o: any) => ({
      _id: o._id,
      orderCode: o.orderCode,
      parentName: o.parentName,
      studentName: o.studentName,
      finalAmount: o.finalAmount || 0,
      saleCommission: o.saleCommission || 0,
      status: o.status,
      saleName: o.saleName,
      saleId: o.saleId,
      createdAt: o.createdAt,
    }));

    // Group by month
    const byMonth: Record<string, { revenue: number; commission: number; count: number }> = {};
    for (const o of orders) {
      if (!['COMPLETED', 'APPROVED'].includes((o as any).status)) continue;
      const month = new Date((o as any).createdAt).toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { revenue: 0, commission: 0, count: 0 };
      byMonth[month].revenue += (o as any).finalAmount || 0;
      byMonth[month].commission += (o as any).saleCommission || 0;
      byMonth[month].count++;
    }

    // Summary
    const completedOrders = orders.filter((o: any) => o.status === 'COMPLETED');
    const approvedOrders = orders.filter((o: any) => o.status === 'APPROVED');

    return {
      details,
      byMonth: Object.entries(byMonth).map(([month, data]) => ({ month, ...data })).sort((a, b) => b.month.localeCompare(a.month)),
      summary: {
        totalRevenue: completedOrders.reduce((s, o: any) => s + (o.finalAmount || 0), 0),
        totalCommission: completedOrders.reduce((s, o: any) => s + (o.saleCommission || 0), 0),
        pendingCommission: approvedOrders.reduce((s, o: any) => s + (o.saleCommission || 0), 0),
        totalOrders: orders.length,
      },
    };
  }
}
