import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument, InvoiceStatus, InvoiceType } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ApproveInvoiceDto } from './dto/approve-invoice.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    private readonly walletsService: WalletsService,
  ) {}

  async create(dto: CreateInvoiceDto, actor: JwtPayload) {
    const existingInvoice = await this.invoiceModel.findOne({ invoiceNumber: dto.invoiceNumber });
    if (existingInvoice) {
      throw new ConflictException('Số hóa đơn đã tồn tại');
    }

    // ── Resolve class info for pricing ──
    let classroom: any = null;
    if (dto.classId) {
      classroom = await this.classModel.findById(dto.classId).lean();
    }

    // Auto-calculate amount if sessions + pricePerSession provided
    let amount = dto.amount;
    if (dto.sessions && dto.pricePerSession && !dto.amount) {
      amount = dto.sessions * dto.pricePerSession;
    }

    // If classId provided but no pricePerSession, get from class
    let pricePerSession = dto.pricePerSession;
    if (classroom && !pricePerSession) {
      pricePerSession = classroom.pricePerSession || 0;
    }

    // ── Reference duration: from DTO → class.baseDuration → default 60 ──
    const referenceDuration =
      dto.referenceDuration ??
      (classroom?.baseDuration || classroom?.sessionDuration || 60);

    // ── Auto-compute pricePerSession from amount + sessions if needed ──
    if (!pricePerSession && amount && dto.sessions) {
      pricePerSession = Math.round(amount / dto.sessions);
    }

    // ── Compute per-minute rate ──
    // VD: 3,800,000 / 20 buổi / 70 phút = 2,714.29 đ/phút
    let perMinuteRate = 0;
    if (pricePerSession && referenceDuration) {
      perMinuteRate = pricePerSession / referenceDuration;
    }

    // ── Resolve saleId: dù ai tạo vẫn ghi nhận sale phụ trách ──
    let saleId = dto.saleId ? new Types.ObjectId(dto.saleId) : undefined;
    if (!saleId) {
      if (actor.role === Role.SALE) {
        saleId = new Types.ObjectId(actor._id);
      } else {
        const student = await this.studentModel.findById(dto.studentId).select('saleId').lean();
        if (student?.saleId) {
          saleId = student.saleId;
        }
      }
    }

    // Mọi hóa đơn đều phải chờ duyệt
    const status = InvoiceStatus.PENDING_APPROVAL;

    const entity = new this.invoiceModel({ 
      ...dto, 
      amount,
      pricePerSession,
      referenceDuration,
      perMinuteRate,
      sessionsRemaining: dto.sessions, // Ban đầu = sessions mua
      invoiceType: dto.invoiceType || InvoiceType.TUITION,
      status,
      saleId,
      studentId: new Types.ObjectId(dto.studentId),
      classId: dto.classId ? new Types.ObjectId(dto.classId) : undefined,
      createdBy: actor._id,
    });
    return entity.save();
  }

  async findAll(actor: JwtPayload) {
    let filter: any = {};
    if (actor.role === Role.SALE) {
      // Sale: xem hóa đơn do mình tạo HOẶC của HS mình phụ trách
      const ownStudents = await this.studentModel
        .find({ saleId: actor._id }, '_id')
        .lean();
      const ownStudentIds = ownStudents.map((s) => s._id);
      filter = {
        $or: [
          { createdBy: actor._id },
          { studentId: { $in: ownStudentIds } },
        ],
      };
    }
    // DIRECTOR, ACCOUNTING, OPS xem tất cả
    return this.invoiceModel.find(filter)
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('saleId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOne(id: string) {
    const invoice = await this.invoiceModel.findById(id)
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession teacherPayPerSession')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('saleId', 'fullName email')
      .lean();
    if (!invoice) throw new NotFoundException('Hóa đơn không tồn tại');
    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto, actor?: JwtPayload) {
    const invoice = await this.invoiceModel.findById(id);
    if (!invoice) throw new NotFoundException('Hóa đơn không tồn tại');

    // SALE chỉ được sửa hóa đơn PENDING_APPROVAL do mình tạo
    if (actor?.role === Role.SALE) {
      if (invoice.createdBy.toString() !== (actor as any)._id.toString()) {
        throw new ForbiddenException('Bạn không có quyền sửa hóa đơn này');
      }
      if (invoice.status !== InvoiceStatus.PENDING_APPROVAL) {
        throw new ForbiddenException('Không thể sửa hóa đơn đã được xử lý');
      }
      // SALE không được tự đổi status
      delete (dto as any).status;
    }

    if (dto.invoiceNumber) {
      const existingInvoice = await this.invoiceModel.findOne({ 
        invoiceNumber: dto.invoiceNumber,
        _id: { $ne: id }
      });
      if (existingInvoice) {
        throw new ConflictException('Số hóa đơn đã tồn tại');
      }
    }

    // Recalculate derived financial fields when relevant fields change
    const updateData: any = { ...dto };
    const sessions = dto.sessions ?? invoice.sessions;
    const amount = dto.amount ?? invoice.amount;
    const referenceDuration = dto.referenceDuration ?? invoice.referenceDuration;
    const pricePerSession = dto.pricePerSession ?? invoice.pricePerSession;

    if (sessions && sessions > 0) {
      const usedSessions = (invoice.sessions || 0) - (invoice.sessionsRemaining || 0);
      updateData.sessionsRemaining = sessions - usedSessions;
    }
    if (sessions && referenceDuration && referenceDuration > 0 && pricePerSession != null) {
      updateData.perMinuteRate = pricePerSession / referenceDuration;
    }

    const updated = await this.invoiceModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('studentId', 'fullName parentName parentPhone')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .lean();
    if (!updated) throw new NotFoundException('Hóa đơn không tồn tại');
    return updated;
  }

  /** Duyệt hoặc từ chối hóa đơn (DIRECTOR / ACCOUNTING) */
  async approveInvoice(id: string, dto: ApproveInvoiceDto, actor: JwtPayload) {
    if (dto.action === 'APPROVE') {
      // Atomic status transition to prevent double-approval race condition
      const invoice = await this.invoiceModel.findOneAndUpdate(
        { _id: id, status: InvoiceStatus.PENDING_APPROVAL },
        {
          $set: {
            status: InvoiceStatus.APPROVED,
            approvedBy: new Types.ObjectId(actor._id),
            approvedAt: new Date(),
          },
        },
        { new: true },
      );
      if (!invoice) {
        // Either not found or already processed
        const exists = await this.invoiceModel.findById(id).lean();
        if (!exists) throw new NotFoundException('Hóa đơn không tồn tại');
        throw new BadRequestException(
          `Hóa đơn đang ở trạng thái "${exists.status}", chỉ có thể duyệt khi ở trạng thái "PENDING_APPROVAL"`,
        );
      }

      // Wallet top-up for TUITION invoices
      if (
        invoice.invoiceType === InvoiceType.TUITION &&
        !invoice.walletTopUpDone &&
        invoice.amount > 0
      ) {
        await this.topUpWalletForInvoice(invoice, actor);
      }
    } else {
      // REJECT - also atomic
      const invoice = await this.invoiceModel.findOneAndUpdate(
        { _id: id, status: InvoiceStatus.PENDING_APPROVAL },
        {
          $set: {
            status: InvoiceStatus.REJECTED,
            approvedBy: new Types.ObjectId(actor._id),
            approvedAt: new Date(),
            rejectedReason: dto.rejectedReason || '',
          },
        },
        { new: true },
      );
      if (!invoice) {
        const exists = await this.invoiceModel.findById(id).lean();
        if (!exists) throw new NotFoundException('Hóa đơn không tồn tại');
        throw new BadRequestException(
          `Hóa đơn đang ở trạng thái "${exists.status}", chỉ có thể duyệt khi ở trạng thái "PENDING_APPROVAL"`,
        );
      }
    }

    return this.invoiceModel.findById(id)
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('saleId', 'fullName email')
      .lean();
  }

  // ──────────────────────────────────────────────────────────────────
  //  INVOICE → WALLET TOP-UP BRIDGE
  // ──────────────────────────────────────────────────────────────────

  /**
   * Khi Invoice TUITION được APPROVED:
   * 1. Tìm parentUserId của student
   * 2. Nạp tiền vào ví PH (auto-approved, không cần duyệt lại)
   * 3. Ghi nhận ledgerEntryId vào invoice để trace
   */
  private async topUpWalletForInvoice(
    invoice: InvoiceDocument,
    approver: JwtPayload,
  ): Promise<void> {
    try {
      // Tìm parentUserId của student
      const student = await this.studentModel
        .findById(invoice.studentId)
        .select('parentUserId fullName')
        .lean();

      if (!student?.parentUserId) {
        this.logger.warn(
          `Invoice ${invoice.invoiceNumber}: Student chưa có parentUserId, không thể nạp ví`,
        );
        return;
      }

      const parentUserId = student.parentUserId.toString();

      // Nạp tiền trực tiếp qua walletsService (auto-approved)
      const ledgerEntry = await this.walletsService.topUpFromInvoice({
        parentUserId,
        invoiceId: (invoice._id as Types.ObjectId).toString(),
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        studentId: invoice.studentId.toString(),
        classId: invoice.classId?.toString(),
        approvedBy: approver._id,
      });

      // Ghi nhận đã nạp ví
      invoice.walletTopUpDone = true;
      invoice.ledgerEntryId = ledgerEntry._id as Types.ObjectId;
      await invoice.save();

      this.logger.log(
        `Invoice ${invoice.invoiceNumber} APPROVED → Wallet topped up ${invoice.amount.toLocaleString('vi-VN')}đ for parent ${parentUserId}`,
      );
    } catch (err) {
      this.logger.error(
        `Invoice ${invoice.invoiceNumber}: Wallet top-up failed: ${(err as Error).message}`,
      );
      // Không throw — invoice vẫn APPROVED, admin sẽ retry thủ công nếu cần
    }
  }

  /** Lấy danh sách hóa đơn chờ duyệt */
  async findPendingApproval() {
    return this.invoiceModel.find({ status: InvoiceStatus.PENDING_APPROVAL })
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async remove(id: string) {
    const invoice = await this.invoiceModel.findById(id);
    if (!invoice) throw new NotFoundException('Hóa đơn không tồn tại');

    // Prevent deleting invoices that have already been processed
    if (
      invoice.status === InvoiceStatus.APPROVED ||
      (invoice as any).status === 'PAID' ||
      invoice.walletTopUpDone
    ) {
      throw new BadRequestException(
        'Không thể xóa hóa đơn đã duyệt/đã thanh toán. Vui lòng liên hệ admin.',
      );
    }

    await this.invoiceModel.findByIdAndDelete(id);
    return invoice.toObject();
  }

  async getInvoicesByStudent(studentId: string) {
    return this.invoiceModel.find({ studentId: new Types.ObjectId(studentId) })
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getAllPaymentInvoices() {
    const students = await this.studentModel.find()
      .populate('productPackage', 'name price')
      .lean();

    const invoices: any[] = [];

    for (const student of students) {
      if (student.payments && student.payments.length > 0) {
        for (const payment of student.payments) {
          invoices.push({
            _id: `${student._id}_${payment.frameIndex}`,
            studentId: student._id,
            studentCode: student.studentCode,
            studentName: student.fullName,
            frameIndex: payment.frameIndex,
            invoiceCode: payment.invoiceCode || '',
            sessionsRegistered: payment.sessionsRegistered || 0,
            pricePerSession: payment.pricePerSession || 0,
            amountCollected: payment.amountCollected || 0,
            sessionsCollected: payment.sessionsCollected || 0,
            invoiceImage: payment.invoiceImage || '',
            confirmStatus: payment.confirmStatus || 'PENDING',
            createdAt: (student as any).createdAt,
          });
        }
      }
    }

    return invoices.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async confirmPayment(studentId: string, frameIndex: number, action: 'CONFIRM' | 'REJECT') {
    const student = await this.studentModel.findById(studentId);
    if (!student) {
      throw new NotFoundException('Học sinh không tồn tại');
    }

    const payment = student.payments?.find(p => p.frameIndex === frameIndex);
    if (!payment) {
      throw new NotFoundException('Không tìm thấy thông tin thanh toán');
    }

    payment.confirmStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED';
    await student.save();

    return { 
      success: true, 
      message: action === 'CONFIRM' ? 'Đã duyệt hóa đơn' : 'Đã từ chối hóa đơn' 
    };
  }
}