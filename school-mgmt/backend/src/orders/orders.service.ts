import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { Lead, LeadDocument, LeadStatus } from '../leads/schemas/lead.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/schemas/audit-log.schema';
import { EnrollmentService, EnrollmentResult } from './enrollment.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private auditLogService: AuditLogService,
    private enrollmentService: EnrollmentService,
  ) {}

  private getActorId(user: JwtPayload): string {
    return user?.sub ?? user?._id ?? (user as any)?.userId;
  }

  private assertSaleOrderAccess(order: any, user: JwtPayload): void {
    if (user.role !== Role.SALE) return;
    const actorId = this.getActorId(user);
    const ownerSaleId = order?.saleId?.toString?.();
    if (!actorId || !ownerSaleId || ownerSaleId !== actorId) {
      throw new NotFoundException('Don hang khong ton tai');
    }
  }

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

  async create(dto: CreateOrderDto, user: JwtPayload): Promise<Order> {
    const orderCode = await this.generateOrderCode();
    const actorId = this.getActorId(user);

    // Resolve adGroupId: Lead takes priority over direct assignment
    let adGroupId = dto.adGroupId;
    let adGroupName = dto.adGroupName;
    let leadForConversion: LeadDocument | null = null;
    if (dto.leadId) {
      leadForConversion = await this.leadModel.findById(dto.leadId);
      if (!leadForConversion) {
        throw new NotFoundException('Lead khong ton tai');
      }

      if ((leadForConversion as any).convertedOrderId) {
        throw new BadRequestException('Lead da co don dang ky lien ket');
      }
      if (
        (leadForConversion as any).status === LeadStatus.NOT_INTERESTED ||
        (leadForConversion as any).status === LeadStatus.NO_RESPONSE
      ) {
        throw new BadRequestException('Khong the tao don tu lead da mat hoac khong phan hoi');
      }

      if (user.role === Role.SALE) {
        const leadSaleId = (leadForConversion as any).saleId?.toString?.();
        if (!leadSaleId || leadSaleId !== actorId) {
          throw new NotFoundException('Lead khong ton tai');
        }
      }

      if (leadForConversion.adGroupId) {
        adGroupId = leadForConversion.adGroupId.toString();
        adGroupName = (leadForConversion as any).adGroupName || adGroupName;
      }
    }

    const order = new this.orderModel({
      ...dto,
      orderCode,
      status: OrderStatus.DRAFT,
      saleId: actorId,
      saleName: user.fullName || user.email,
      adGroupId,
      adGroupName,
    });
    const saved = await order.save();

    if (leadForConversion) {
      leadForConversion.status = LeadStatus.CONVERTED;
      (leadForConversion as any).convertedOrderId = (saved as any)._id;
      await leadForConversion.save();
    }

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'ORDERS' as any,
      targetId: saved._id?.toString(),
      targetName: saved.orderCode,
      description: `Táº¡o Ä‘Æ¡n Ä‘Äƒng kÃ½: ${saved.orderCode} - ${saved.studentName}`,
    });

    return saved;
  }

  async findAll(query: QueryOrderDto, user: JwtPayload) {
    const filter: FilterQuery<OrderDocument> = {};
    const actorId = this.getActorId(user);

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
    if (user.role === Role.SALE) {
      filter.saleId = actorId;
    }

    return this.orderModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string, user?: JwtPayload): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');
    if (user) this.assertSaleOrderAccess(order, user);
    return order as Order;
  }

  async update(id: string, dto: UpdateOrderDto, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');
    this.assertSaleOrderAccess(order, user);
    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.NEEDS_INFO].includes(o.status)) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ sá»­a Ä‘Æ¡n á»Ÿ tráº¡ng thÃ¡i NhÃ¡p hoáº·c Cáº§n bá»• sung');
    }

    const updated = await this.orderModel.findByIdAndUpdate(id, dto, { new: true }).lean();

    await this.auditLogService.log({
      userId: actorId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.UPDATE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Cáº­p nháº­t Ä‘Æ¡n ${o.orderCode}`,
      newValue: dto as any,
    });

    return updated as Order;
  }

  async submit(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');
    this.assertSaleOrderAccess(order, user);

    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.NEEDS_INFO].includes(o.status)) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ gá»­i duyá»‡t Ä‘Æ¡n á»Ÿ tráº¡ng thÃ¡i NhÃ¡p hoáº·c Cáº§n bá»• sung');
    }

    if (!o.items || o.items.length === 0) {
      throw new BadRequestException('ÄÆ¡n hÃ ng pháº£i cÃ³ Ã­t nháº¥t 1 sáº£n pháº©m');
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id, { status: OrderStatus.SUBMITTED }, { new: true },
    ).lean();

    await this.auditLogService.log({
      userId: actorId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.STATUS_CHANGE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Gá»­i duyá»‡t Ä‘Æ¡n ${o.orderCode}`,
    });

    return updated as Order;
  }

  async approve(id: string, user: JwtPayload): Promise<{ order: Order; enrollment: EnrollmentResult }> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ duyá»‡t Ä‘Æ¡n Ä‘ang chá» duyá»‡t');
    }

    // ÄÃ¡nh dáº¥u APPROVED trÆ°á»›c
    await this.orderModel.findByIdAndUpdate(
      id,
      {
        status: OrderStatus.APPROVED,
        approvedBy: actorId,
        approvedAt: new Date(),
      },
      { new: true },
    );

    // Audit log duyá»‡t Ä‘Æ¡n
    await this.auditLogService.log({
      userId: actorId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.APPROVE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Duyá»‡t Ä‘Æ¡n ${o.orderCode} - ${o.studentName}`,
    });

    // Auto-enrollment: táº¡o Student, Invoice, ghi log
    const enrollment = await this.enrollmentService.processApprovedOrder(id, user);

    // Láº¥y láº¡i order sau khi enrollment cáº­p nháº­t
    const updatedOrder = await this.orderModel.findById(id).lean();

    return {
      order: updatedOrder as Order,
      enrollment,
    };
  }

  async reject(id: string, reason: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ tá»« chá»‘i Ä‘Æ¡n Ä‘ang chá» duyá»‡t');
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      { status: OrderStatus.REJECTED, rejectionReason: reason },
      { new: true },
    ).lean();

    await this.auditLogService.log({
      userId: actorId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.REJECT, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Tá»« chá»‘i Ä‘Æ¡n ${o.orderCode}: ${reason}`,
    });

    return updated as Order;
  }

  async requestInfo(id: string, reason: string, user: JwtPayload): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException('Chá»‰ yÃªu cáº§u bá»• sung cho Ä‘Æ¡n Ä‘ang chá» duyá»‡t');
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      { status: OrderStatus.NEEDS_INFO, needsInfoReason: reason },
      { new: true },
    ).lean();

    return updated as Order;
  }

  async cancel(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');
    this.assertSaleOrderAccess(order, user);

    const o = order as any;
    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(o.status)) {
      throw new BadRequestException('KhÃ´ng thá»ƒ há»§y Ä‘Æ¡n Ä‘Ã£ hoÃ n táº¥t hoáº·c Ä‘Ã£ há»§y');
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id, { status: OrderStatus.CANCELLED }, { new: true },
    ).lean();

    await this.auditLogService.log({
      userId: actorId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.STATUS_CHANGE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `Há»§y Ä‘Æ¡n ${o.orderCode}`,
    });

    return updated as Order;
  }

  async getPipeline(user: JwtPayload) {
    const match: any = {};
    if (user.role === Role.SALE) match.saleId = this.getActorId(user);

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

  async getStats(user: JwtPayload) {
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const match: any = {};
    if (user.role === Role.SALE) match.saleId = this.getActorId(user);

    const stats = await this.orderModel.aggregate([
      { $match: match },
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

  async remove(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');
    this.assertSaleOrderAccess(order, user);
    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.CANCELLED].includes(o.status)) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ xÃ³a Ä‘Æ¡n NhÃ¡p hoáº·c ÄÃ£ há»§y');
    }

    await this.orderModel.findByIdAndDelete(id);

    await this.auditLogService.log({
      userId: actorId, userEmail: user.email, userFullName: user.fullName, userRole: user.role,
      action: AuditAction.DELETE, module: 'ORDERS' as any,
      targetId: id, targetName: o.orderCode,
      description: `XÃ³a Ä‘Æ¡n ${o.orderCode}`,
    });

    return order as Order;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // COMMISSION REPORT (Phase 1.3)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

