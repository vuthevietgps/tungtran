import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument, InvoiceStatus, InvoiceType } from '../invoices/schemas/invoice.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { Role } from '../common/interfaces/role.enum';

export interface EnrollmentResult {
  success: boolean;
  studentId?: string;
  studentCode?: string;
  invoiceIds?: string[];
  classIds?: string[];
  errors?: string[];
}

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Xử lý tự động khi đơn được duyệt:
   * 1. Tạo Student (nếu chưa có)
   * 2. Tạo Invoice cho mỗi item
   * 3. Cập nhật processedResults vào Order
   * 4. Đổi status → COMPLETED
   * 5. Ghi audit log + gửi thông báo
   */
  async processApprovedOrder(orderId: string, approver: any): Promise<EnrollmentResult> {
    const errors: string[] = [];
    const order = await this.orderModel.findById(orderId).lean();
    if (!order) {
      return { success: false, errors: ['Order không tồn tại'] };
    }

    const o = order as any;

    try {
      // ── Step 1: Tạo hoặc tìm Student ──
      const { studentId, studentCode, isNew } = await this.findOrCreateStudent(o, approver);

      // ── Step 2: Tạo Invoice cho mỗi item ──
      const invoiceIds: string[] = [];
      for (const item of o.items) {
        try {
          const invoiceId = await this.createInvoiceForItem(o, item, studentId, approver);
          invoiceIds.push(invoiceId);
        } catch (err) {
          const msg = `Lỗi tạo hóa đơn cho ${item.productName || item.productId}: ${(err as Error).message}`;
          this.logger.error(msg);
          errors.push(msg);
        }
      }

      // ── Step 3: Cập nhật processedResults + status → COMPLETED ──
      await this.orderModel.findByIdAndUpdate(orderId, {
        status: OrderStatus.COMPLETED,
        processedResults: {
          studentId: new Types.ObjectId(studentId),
          invoiceIds: invoiceIds.map(id => new Types.ObjectId(id)),
          classIds: [], // Classes sẽ được tạo sau khi Invoice được duyệt thanh toán
        },
      });

      // ── Step 4: Audit log ──
      await this.auditLogService.log({
        userId: approver.userId,
        userEmail: approver.email,
        userFullName: approver.fullName,
        userRole: approver.role,
        action: AuditAction.STATUS_CHANGE,
        module: AuditModule.ORDERS,
        targetId: orderId,
        targetName: o.orderCode,
        description: `Đơn ${o.orderCode} → COMPLETED. Tự động tạo: Student ${studentCode}${isNew ? ' (mới)' : ''}, ${invoiceIds.length} hóa đơn.`,
        newValue: { studentId, studentCode, invoiceIds, errors } as any,
      });

      // ── Step 5: Thông báo cho Sale ──
      if (o.saleId) {
        await this.notificationsService.create({
          recipientId: o.saleId.toString(),
          recipientRole: Role.SALE,
          type: NotificationType.SYSTEM,
          title: `Đơn ${o.orderCode} đã hoàn tất`,
          message: `Đơn ${o.orderCode} (${o.studentName}) đã được duyệt và xử lý tự động. Học viên: ${studentCode}, ${invoiceIds.length} hóa đơn đã tạo.`,
          link: `/orders`,
          targetId: orderId,
          targetModule: 'ORDERS',
        });
      }

      // Thông báo cho OPS
      await this.notificationsService.notifyByRole(Role.OPS, {
        type: NotificationType.SYSTEM,
        title: `Enrollment tự động: ${o.orderCode}`,
        message: `Đơn ${o.orderCode} (${o.studentName}) đã xử lý xong: Student ${studentCode}, ${invoiceIds.length} hóa đơn.${errors.length ? ' Có lỗi: ' + errors.join('; ') : ''}`,
        link: `/orders`,
        targetId: orderId,
        targetModule: 'ORDERS',
      });

      return {
        success: errors.length === 0,
        studentId,
        studentCode,
        invoiceIds,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err) {
      this.logger.error(`Enrollment failed for order ${o.orderCode}: ${(err as Error).message}`);

      // Rollback: đổi lại status APPROVED để OPS xử lý thủ công
      await this.orderModel.findByIdAndUpdate(orderId, {
        status: OrderStatus.APPROVED,
      });

      return {
        success: false,
        errors: [`Enrollment thất bại: ${(err as Error).message}`],
      };
    }
  }

  // ────────────────────────────────────────────────
  //  STUDENT
  // ────────────────────────────────────────────────

  private async findOrCreateStudent(
    order: any,
    approver: any,
  ): Promise<{ studentId: string; studentCode: string; isNew: boolean }> {
    // Nếu order đã link existingStudentId → dùng luôn
    if (order.existingStudentId) {
      const existing = await this.studentModel.findById(order.existingStudentId).lean();
      if (existing) {
        return {
          studentId: (existing as any)._id.toString(),
          studentCode: (existing as any).studentCode,
          isNew: false,
        };
      }
    }

    // Tìm student theo parentPhone + studentName (tránh trùng)
    const existingByPhone = await this.studentModel.findOne({
      parentPhone: order.parentPhone,
      fullName: order.studentName,
    }).lean();

    if (existingByPhone) {
      return {
        studentId: (existingByPhone as any)._id.toString(),
        studentCode: (existingByPhone as any).studentCode,
        isNew: false,
      };
    }

    // Tạo student mới
    const studentCode = await this.generateStudentCode();
    const age = order.studentDob ? this.calculateAge(order.studentDob) : 10; // default age

    const student = new this.studentModel({
      studentCode,
      fullName: order.studentName,
      age,
      parentName: order.parentName,
      parentPhone: order.parentPhone,
      parentUserId: order.parentUserId || undefined,
      faceImage: 'default-avatar.png', // placeholder
      grade: order.studentGrade || undefined,
      saleId: order.saleId,
      saleName: order.saleName,
      approvalStatus: 'APPROVED', // Auto-approve khi đơn đã được Director/OPS duyệt
      approvedBy: approver.userId,
      approvedAt: new Date(),
    });

    const saved = await student.save();

    // Audit log cho student mới
    await this.auditLogService.log({
      userId: approver.userId,
      userEmail: approver.email,
      userFullName: approver.fullName,
      userRole: approver.role,
      action: AuditAction.CREATE,
      module: AuditModule.STUDENTS,
      targetId: (saved as any)._id.toString(),
      targetName: studentCode,
      description: `Tự động tạo học viên ${studentCode} - ${order.studentName} từ đơn ${order.orderCode}`,
    });

    return {
      studentId: (saved as any)._id.toString(),
      studentCode,
      isNew: true,
    };
  }

  // ────────────────────────────────────────────────
  //  INVOICE
  // ────────────────────────────────────────────────

  private async createInvoiceForItem(
    order: any,
    item: any,
    studentId: string,
    approver: any,
  ): Promise<string> {
    const invoiceNumber = await this.generateInvoiceNumber();

    // Tính giá theo item
    const sessions = item.sessions || 1;
    const pricePerSession = item.pricePerSession || 0;
    const amount = item.amount || sessions * pricePerSession;
    const sessionDuration = item.sessionDuration || 90;

    // Per-minute rate
    const perMinuteRate = pricePerSession && sessionDuration
      ? pricePerSession / sessionDuration
      : 0;

    const invoice = new this.invoiceModel({
      invoiceNumber,
      invoiceType: InvoiceType.TUITION,
      studentId: new Types.ObjectId(studentId),
      saleId: order.saleId ? new Types.ObjectId(order.saleId.toString()) : undefined,
      sessions,
      pricePerSession,
      referenceDuration: sessionDuration,
      perMinuteRate,
      sessionsRemaining: sessions,
      amount,
      paymentDate: new Date(), // Ngày tạo
      description: `Hóa đơn tự động từ đơn ${order.orderCode} — ${item.productName || 'Gói học'}`,
      status: InvoiceStatus.PENDING_APPROVAL,
      createdBy: new Types.ObjectId(approver.userId),
    });

    const saved = await invoice.save();
    const invoiceId = (saved as any)._id.toString();

    // Audit log
    await this.auditLogService.log({
      userId: approver.userId,
      userEmail: approver.email,
      userFullName: approver.fullName,
      userRole: approver.role,
      action: AuditAction.CREATE,
      module: AuditModule.INVOICES,
      targetId: invoiceId,
      targetName: invoiceNumber,
      description: `Tự động tạo hóa đơn ${invoiceNumber} từ đơn ${order.orderCode}: ${sessions} buổi × ${pricePerSession.toLocaleString()}đ = ${amount.toLocaleString()}đ`,
    });

    // Thông báo duyệt invoice cho Director
    await this.notificationsService.notifyByRole(Role.DIRECTOR, {
      type: NotificationType.INVOICE_PENDING,
      title: `Hóa đơn mới: ${invoiceNumber}`,
      message: `Hóa đơn ${invoiceNumber} (${amount.toLocaleString('vi-VN')}đ) tự động tạo từ đơn ${order.orderCode} — ${order.studentName}. Cần duyệt.`,
      link: `/invoices`,
      targetId: invoiceId,
      targetModule: 'INVOICES',
    });

    return invoiceId;
  }

  // ────────────────────────────────────────────────
  //  CODE GENERATORS
  // ────────────────────────────────────────────────

  private async generateStudentCode(): Promise<string> {
    const prefix = 'HS';
    const last = await this.studentModel
      .findOne({ studentCode: { $regex: `^${prefix}\\d+$` } })
      .sort({ studentCode: -1 })
      .lean();

    let nextNum = 1;
    if (last) {
      const match = (last as any).studentCode.match(/^HS(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    const last = await this.invoiceModel
      .findOne({ invoiceNumber: { $regex: `^${prefix}` } })
      .sort({ invoiceNumber: -1 })
      .lean();

    let nextNum = 1;
    if (last) {
      const parts = (last as any).invoiceNumber.replace(prefix, '');
      nextNum = parseInt(parts, 10) + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  private calculateAge(dob: Date | string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(3, Math.min(25, age)); // Clamp to valid range
  }
}
