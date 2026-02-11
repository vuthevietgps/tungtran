import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import {
  Payroll,
  PayrollDocument,
  PayrollStatus,
  PayrollItem,
  PayrollItemDocument,
  PayrollItemStatus,
} from './schemas/payroll.schema';

import { SessionsService } from '../sessions/sessions.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';

import { CreatePayrollDto } from './dto/create-payroll.dto';
import { QueryPayrollDto } from './dto/query-payroll.dto';
import { AdjustPayrollItemDto } from './dto/adjust-payroll-item.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(PayrollItem.name) private payrollItemModel: Model<PayrollItemDocument>,
    @InjectConnection() private connection: Connection,
    private readonly sessionsService: SessionsService,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  GENERATE PAYROLL (Tạo bảng lương)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Tạo bảng lương cho 1 GV trong 1 kỳ.
   * Tự động kéo tất cả sessions FINALIZED + chưa tính lương trong kỳ.
   */
  async generate(dto: CreatePayrollDto, createdBy: string): Promise<PayrollDocument> {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodEnd <= periodStart) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // Check duplicate payroll for same teacher + overlapping period
    const existing = await this.payrollModel.findOne({
      teacherId: new Types.ObjectId(dto.teacherId),
      periodStart: { $lte: periodEnd },
      periodEnd: { $gte: periodStart },
      status: { $nin: [PayrollStatus.REJECTED] },
    });
    if (existing) {
      throw new BadRequestException(
        `Đã tồn tại bảng lương cho GV này trong kỳ trùng (${existing.payrollCode})`,
      );
    }

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      // Pull finalized sessions INSIDE the transaction for atomicity
      const { count, totalPayout, sessions } =
        await this.sessionsService.countFinalizedForPayroll(
          dto.teacherId,
          periodStart,
          periodEnd,
          mongoSession,
        );

      if (count === 0) {
        throw new BadRequestException(
          'Không có buổi dạy nào đủ điều kiện tính lương trong kỳ này',
        );
      }

      // Atomically claim sessions within the transaction to prevent
      // concurrent payroll generation from grabbing the same sessions.
      // MongoDB will raise WriteConflict if another transaction touches these docs.
      const sessionIds = sessions.map((s) => s._id);
      await this.sessionsService.markTeacherPaid(
        sessionIds.map((id) => id.toString()),
        mongoSession,
      );

      // Generate payroll code: PRL-{YYYYMM}-{teacherIdShort}
      const ym = `${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
      const shortId = dto.teacherId.slice(-6).toUpperCase();
      const payrollCode = `PRL-${ym}-${shortId}`;

      const bonusAmount = dto.bonusAmount ?? 0;
      const deductionAmount = dto.deductionAmount ?? 0;
      const netAmount = totalPayout + bonusAmount - deductionAmount;

      // Create payroll
      const [payroll] = await this.payrollModel.create(
        [
          {
            teacherId: new Types.ObjectId(dto.teacherId),
            periodStart,
            periodEnd,
            payrollCode,
            totalSessions: count,
            grossAmount: totalPayout,
            adjustmentAmount: 0,
            bonusAmount,
            deductionAmount,
            netAmount,
            status: PayrollStatus.DRAFT,
            createdBy: new Types.ObjectId(createdBy),
            notes: dto.notes,
          },
        ],
        { session: mongoSession },
      );

      // Create payroll items (1 per session)
      const items = sessions.map((s) => ({
        payrollId: payroll._id,
        sessionId: s._id,
        classId: s.classId,
        studentId: s.studentId,
        sessionDate: s.scheduledDate,
        teacherPayout: s.teacherPayout,
        adjustedPayout: s.teacherPayout,
        status: PayrollItemStatus.INCLUDED,
      }));

      await this.payrollItemModel.insertMany(items, { session: mongoSession });

      await mongoSession.commitTransaction();
      this.logger.log(
        `Payroll generated: ${payrollCode} | ${count} sessions | net: ${netAmount}đ`,
      );
      return payroll;
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUERY
  // ══════════════════════════════════════════════════════════════════

  async findAll(query: QueryPayrollDto) {
    const filter: FilterQuery<Payroll> = {};

    if (query.teacherId) filter.teacherId = new Types.ObjectId(query.teacherId);
    if (query.status) filter.status = query.status;
    if (query.fromDate || query.toDate) {
      filter.periodStart = {};
      if (query.fromDate) filter.periodStart.$gte = new Date(query.fromDate);
      if (query.toDate) filter.periodStart.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-createdAt';

    const [data, total] = await Promise.all([
      this.payrollModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('teacherId', 'fullName email phone')
        .populate('createdBy', 'fullName')
        .populate('approvedBy', 'fullName')
        .lean(),
      this.payrollModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, actor?: JwtPayload): Promise<PayrollDocument> {
    const payroll = await this.payrollModel
      .findById(id)
      .populate('teacherId', 'fullName email phone')
      .populate('createdBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('paidBy', 'fullName');

    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');

    // TEACHER can only view their own payroll
    if (actor?.role === Role.TEACHER && payroll.teacherId?.toString() !== actor.sub) {
      throw new ForbiddenException('Bạn không có quyền xem bảng lương này');
    }
    return payroll;
  }

  /** Lấy danh sách items của 1 payroll */
  async getPayrollItems(payrollId: string, actor?: JwtPayload): Promise<PayrollItemDocument[]> {
    // Verify ownership for TEACHER
    if (actor?.role === Role.TEACHER) {
      const payroll = await this.payrollModel.findById(payrollId).lean();
      if (!payroll || payroll.teacherId?.toString() !== actor.sub) {
        throw new ForbiddenException('Bạn không có quyền xem bảng lương này');
      }
    }
    return this.payrollItemModel
      .find({ payrollId: new Types.ObjectId(payrollId) })
      .populate('sessionId', 'scheduledDate scheduledStartTime scheduledEndTime status')
      .populate('classId', 'name code')
      .populate('studentId', 'fullName studentCode')
      .sort('sessionDate')
      .lean() as any;
  }

  // ══════════════════════════════════════════════════════════════════
  //  UPDATE (chỉ DRAFT)
  // ══════════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdatePayrollDto): Promise<PayrollDocument> {
    const payroll = await this.payrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');

    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ sửa được bảng lương DRAFT');
    }

    if (dto.bonusAmount !== undefined) payroll.bonusAmount = dto.bonusAmount;
    if (dto.deductionAmount !== undefined) payroll.deductionAmount = dto.deductionAmount;
    if (dto.notes !== undefined) payroll.notes = dto.notes;

    // Recalc net
    payroll.netAmount =
      payroll.grossAmount +
      payroll.adjustmentAmount +
      payroll.bonusAmount -
      payroll.deductionAmount;

    return payroll.save();
  }

  /** Điều chỉnh 1 item (chỉ khi payroll DRAFT) */
  async adjustItem(
    payrollId: string,
    itemId: string,
    dto: AdjustPayrollItemDto,
  ): Promise<PayrollItemDocument> {
    const payroll = await this.payrollModel.findById(payrollId);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ điều chỉnh được khi DRAFT');
    }

    const item = await this.payrollItemModel.findOne({
      _id: new Types.ObjectId(itemId),
      payrollId: new Types.ObjectId(payrollId),
    });
    if (!item) throw new NotFoundException('Item không tồn tại trong payroll');

    const oldPayout = item.adjustedPayout;
    item.adjustedPayout = dto.adjustedPayout;
    if (dto.adjustmentReason) item.adjustmentReason = dto.adjustmentReason;
    if (dto.status) item.status = dto.status;
    await item.save();

    // Recalc payroll totals
    await this.recalcPayrollTotals(payrollId);

    return item;
  }

  // ══════════════════════════════════════════════════════════════════
  //  WORKFLOW: SUBMIT → APPROVE → PAY
  // ══════════════════════════════════════════════════════════════════

  /** OPS/ACCOUNTING submit để DIRECTOR duyệt */
  async submitForReview(id: string): Promise<PayrollDocument> {
    const payroll = await this.payrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ submit được bảng lương DRAFT');
    }

    payroll.status = PayrollStatus.PENDING_REVIEW;
    return payroll.save();
  }

  /** DIRECTOR phê duyệt */
  async approve(id: string, approvedBy: string): Promise<PayrollDocument> {
    const payroll = await this.payrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== PayrollStatus.PENDING_REVIEW) {
      throw new BadRequestException('Chỉ duyệt được bảng lương PENDING_REVIEW');
    }

    payroll.status = PayrollStatus.APPROVED;
    payroll.approvedBy = new Types.ObjectId(approvedBy);
    payroll.approvedAt = new Date();
    return payroll.save();
  }

  /** DIRECTOR từ chối → trả về REJECTED, giải phóng sessions */
  async reject(id: string, rejectedBy: string, reason: string): Promise<PayrollDocument> {
    const payroll = await this.payrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== PayrollStatus.PENDING_REVIEW) {
      throw new BadRequestException('Chỉ từ chối được bảng lương PENDING_REVIEW');
    }

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      payroll.status = PayrollStatus.REJECTED;
      payroll.rejectionReason = reason;
      payroll.approvedBy = new Types.ObjectId(rejectedBy);
      payroll.approvedAt = new Date();
      await payroll.save({ session: mongoSession });

      // Release claimed sessions so they can be picked up by a new payroll
      const items = await this.payrollItemModel
        .find({ payrollId: payroll._id, status: PayrollItemStatus.INCLUDED })
        .session(mongoSession);
      const sessionIds = items.map((i) => i.sessionId.toString());
      if (sessionIds.length > 0) {
        await this.sessionsService.unmarkTeacherPaid(sessionIds, mongoSession);
      }

      await mongoSession.commitTransaction();
      return payroll;
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  /** Reopen rejected payroll → DRAFT (để sửa lại) */
  async reopen(id: string): Promise<PayrollDocument> {
    const payroll = await this.payrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== PayrollStatus.REJECTED) {
      throw new BadRequestException('Chỉ mở lại được bảng lương REJECTED');
    }

    // Re-claim sessions that were released during reject
    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();
    try {
      const items = await this.payrollItemModel
        .find({ payrollId: payroll._id, status: PayrollItemStatus.INCLUDED })
        .session(mongoSession);
      const sessionIds = items.map((i) => i.sessionId.toString());

      if (sessionIds.length > 0) {
        // Check if any sessions have been claimed by another payroll
        const alreadyClaimed = await this.sessionsService.checkTeacherPaid(sessionIds);
        if (alreadyClaimed.length > 0) {
          await mongoSession.abortTransaction();
          throw new BadRequestException(
            `Không thể mở lại: ${alreadyClaimed.length} buổi học đã được gán cho bảng lương khác`,
          );
        }
        await this.sessionsService.markTeacherPaid(sessionIds, mongoSession);
      }

      payroll.status = PayrollStatus.DRAFT;
      payroll.rejectionReason = undefined;
      payroll.approvedBy = undefined;
      payroll.approvedAt = undefined;
      await payroll.save({ session: mongoSession });

      await mongoSession.commitTransaction();
      return payroll;
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  /**
   * ACCOUNTING xác nhận đã chi lương → PAID.
   * Đánh dấu tất cả sessions trong payroll là isTeacherPaid = true.
   */
  async markPaid(
    id: string,
    paidBy: string,
    paymentRef?: string,
  ): Promise<PayrollDocument> {
    const payroll = await this.payrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException('Chỉ chi lương được bảng lương APPROVED');
    }

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      // Mark payroll as PAID
      payroll.status = PayrollStatus.PAID;
      payroll.paidAt = new Date();
      payroll.paidBy = new Types.ObjectId(paidBy);
      if (paymentRef) payroll.paymentRef = paymentRef;
      await payroll.save({ session: mongoSession });

      // Get all INCLUDED session IDs and mark as teacher paid
      const items = await this.payrollItemModel
        .find({
          payrollId: payroll._id,
          status: PayrollItemStatus.INCLUDED,
        })
        .session(mongoSession);

      const sessionIds = items.map((i) => i.sessionId.toString());
      if (sessionIds.length > 0) {
        await this.sessionsService.markTeacherPaid(sessionIds, mongoSession);
      }

      await mongoSession.commitTransaction();
      this.logger.log(
        `Payroll ${payroll.payrollCode} marked PAID | ${sessionIds.length} sessions | net: ${payroll.netAmount}đ`,
      );
      return payroll;
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  DELETE (chỉ DRAFT)
  // ══════════════════════════════════════════════════════════════════

  async remove(id: string): Promise<void> {
    const payroll = await this.payrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ xóa được bảng lương DRAFT');
    }

    // Release claimed sessions before deleting
    const items = await this.payrollItemModel.find({
      payrollId: payroll._id,
      status: PayrollItemStatus.INCLUDED,
    });
    const sessionIds = items.map((i) => i.sessionId.toString());
    if (sessionIds.length > 0) {
      await this.sessionsService.unmarkTeacherPaid(sessionIds);
    }

    await this.payrollItemModel.deleteMany({ payrollId: payroll._id });
    await this.payrollModel.findByIdAndDelete(id);
  }

  // ══════════════════════════════════════════════════════════════════
  //  BULK GENERATE (tạo bảng lương cho tất cả GV)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Tạo bảng lương cho tất cả GV có buổi dạy trong kỳ.
   * Gọi khi ACCOUNTING muốn tạo đợt lương hàng tháng.
   */
  async bulkGenerate(
    periodStart: string,
    periodEnd: string,
    createdBy: string,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    // Get distinct teachers with finalized sessions in period
    const { default: mongoose } = await import('mongoose');
    const SessionModel = this.connection.model('Session');

    const teacherIds: Types.ObjectId[] = await SessionModel.distinct('teacherId', {
      status: 'FINALIZED',
      isTeacherPaid: false,
      'confirmation.finalizedAt': {
        $gte: new Date(periodStart),
        $lte: new Date(periodEnd),
      },
    });

    let created = 0;
    const skipped: number[] = [];
    const errors: string[] = [];

    for (const tid of teacherIds) {
      try {
        await this.generate(
          {
            teacherId: tid.toString(),
            periodStart,
            periodEnd,
          },
          createdBy,
        );
        created++;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Đã tồn tại')) {
          skipped.push(1);
        } else {
          errors.push(`Teacher ${tid}: ${msg}`);
        }
      }
    }

    return { created, skipped: skipped.length, errors };
  }

  // ══════════════════════════════════════════════════════════════════
  //  STATS
  // ══════════════════════════════════════════════════════════════════

  /** Tổng hợp payroll theo trạng thái */
  async getPayrollSummary() {
    return this.payrollModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalNet: { $sum: '$netAmount' },
          totalGross: { $sum: '$grossAmount' },
        },
      },
    ]);
  }

  // ══════════════════════════════════════════════════════════════════
  //  TEACHER PAYROLL PREVIEW (Xem trước lương GV chi tiết)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Thống kê chi tiết sessions của 1 GV trong kỳ:
   * - Tổng buổi đã điểm danh (TEACHER_COMPLETED + PARENT_CONFIRMED + FINALIZED)
   * - Buổi đủ điều kiện tính lương (FINALIZED + hasTeachingReport + !isTeacherPaid)
   * - Buổi thiếu báo cáo (FINALIZED nhưng chưa có teaching report)
   * - Buổi chờ xác nhận PH (TEACHER_COMPLETED)
   * - Buổi đã thanh toán (isTeacherPaid = true)
   * - Buổi bị hủy / vắng
   * - Danh sách chi tiết từng buổi
   */
  async getTeacherPayrollPreview(
    teacherId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    const from = new Date(periodStart);
    const to = new Date(periodEnd);

    const SessionModel = this.connection.model('Session');

    // Pull all non-SCHEDULED sessions for this teacher in the period
    const sessions = await SessionModel.find({
      teacherId: new Types.ObjectId(teacherId),
      scheduledDate: { $gte: from, $lte: to },
      status: { $nin: ['RESCHEDULED'] },
    })
      .populate('classId', 'name code')
      .populate('studentId', 'fullName studentCode')
      .sort('scheduledDate')
      .lean();

    // Categorize sessions
    const attended: any[] = []; // TEACHER_COMPLETED + PARENT_CONFIRMED + FINALIZED
    const eligibleForPayroll: any[] = []; // FINALIZED + hasTeachingReport + !isTeacherPaid
    const missingReport: any[] = []; // FINALIZED / TEACHER_COMPLETED / PARENT_CONFIRMED but no report
    const pendingParentConfirm: any[] = []; // TEACHER_COMPLETED (chờ PH xác nhận)
    const alreadyPaid: any[] = []; // isTeacherPaid = true
    const cancelled: any[] = []; // CANCELLED
    const noShow: any[] = []; // NO_SHOW
    const pendingFinalize: any[] = []; // PARENT_CONFIRMED but not yet FINALIZED
    const finalizedNoReport: any[] = []; // FINALIZED but !hasTeachingReport

    for (const s of sessions) {
      const session: any = s;
      const status = session.status;
      const hasReport = !!session.hasTeachingReport;
      const isPaid = !!session.isTeacherPaid;

      // Attended = all sessions where teacher completed teaching
      if (['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(status)) {
        attended.push(session);
      }

      // Already paid
      if (isPaid) {
        alreadyPaid.push(session);
        continue; // Don't double-categorize paid sessions
      }

      // Eligible for payroll: FINALIZED + has report + not yet paid
      if (status === 'FINALIZED' && hasReport && !isPaid) {
        eligibleForPayroll.push(session);
      }

      // FINALIZED but missing report → can't be paid
      if (status === 'FINALIZED' && !hasReport) {
        finalizedNoReport.push(session);
        missingReport.push(session);
      }

      // TEACHER_COMPLETED or PARENT_CONFIRMED but missing report
      if (['TEACHER_COMPLETED', 'PARENT_CONFIRMED'].includes(status) && !hasReport) {
        missingReport.push(session);
      }

      // Pending parent confirmation
      if (status === 'TEACHER_COMPLETED') {
        pendingParentConfirm.push(session);
      }

      // PARENT_CONFIRMED but not yet finalized
      if (status === 'PARENT_CONFIRMED') {
        pendingFinalize.push(session);
      }

      // Cancelled
      if (status === 'CANCELLED') {
        cancelled.push(session);
      }

      // No-show
      if (status === 'NO_SHOW') {
        noShow.push(session);
      }
    }

    // Existing payrolls for this teacher in this period
    const existingPayrolls = await this.payrollModel
      .find({
        teacherId: new Types.ObjectId(teacherId),
        periodStart: { $lte: to },
        periodEnd: { $gte: from },
      })
      .populate('createdBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .sort('-createdAt')
      .lean();

    return {
      teacherId,
      periodStart: from,
      periodEnd: to,

      summary: {
        totalSessions: sessions.length,
        totalAttended: attended.length,
        eligibleForPayroll: eligibleForPayroll.length,
        missingReport: missingReport.length,
        pendingParentConfirm: pendingParentConfirm.length,
        pendingFinalize: pendingFinalize.length,
        finalizedNoReport: finalizedNoReport.length,
        alreadyPaid: alreadyPaid.length,
        cancelled: cancelled.length,
        noShow: noShow.length,
      },

      amounts: {
        totalEligiblePayout: eligibleForPayroll.reduce((acc, s) => acc + (s.teacherPayout || 0), 0),
        totalAlreadyPaid: alreadyPaid.reduce((acc, s) => acc + (s.teacherPayout || 0), 0),
        totalBlockedByReport: finalizedNoReport.reduce((acc, s) => acc + (s.teacherPayout || 0), 0),
        totalPendingConfirm: pendingParentConfirm.reduce((acc, s) => acc + (s.teacherPayout || 0), 0),
        totalPendingFinalize: pendingFinalize.reduce((acc, s) => acc + (s.teacherPayout || 0), 0),
        totalAttendedPayout: attended.reduce((acc, s) => acc + (s.teacherPayout || 0), 0),
      },

      sessions: sessions.map((s: any) => ({
        _id: s._id,
        classId: s.classId,
        studentId: s.studentId,
        scheduledDate: s.scheduledDate,
        durationMinutes: s.durationMinutes,
        teacherPayout: s.teacherPayout,
        status: s.status,
        hasTeachingReport: !!s.hasTeachingReport,
        isTeacherPaid: !!s.isTeacherPaid,
        isPaid: !!s.isPaid,
        confirmation: s.confirmation,
        teachingReport: s.teachingReport
          ? {
              lessonContent: s.teachingReport.lessonContent,
              submittedAt: s.teachingReport.submittedAt,
              isLateSubmission: s.teachingReport.isLateSubmission,
            }
          : null,
        payrollStatus: s.isTeacherPaid
          ? 'PAID'
          : s.status === 'FINALIZED' && s.hasTeachingReport
            ? 'ELIGIBLE'
            : s.status === 'FINALIZED' && !s.hasTeachingReport
              ? 'BLOCKED_NO_REPORT'
              : s.status === 'TEACHER_COMPLETED'
                ? 'WAITING_PARENT'
                : s.status === 'PARENT_CONFIRMED'
                  ? 'WAITING_FINALIZE'
                  : s.status === 'CANCELLED'
                    ? 'CANCELLED'
                    : s.status === 'NO_SHOW'
                      ? 'NO_SHOW'
                      : 'OTHER',
      })),

      existingPayrolls,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════════

  /** Tính lại totals từ items (sau khi adjust item) */
  private async recalcPayrollTotals(payrollId: string): Promise<void> {
    const items = await this.payrollItemModel.find({
      payrollId: new Types.ObjectId(payrollId),
      status: PayrollItemStatus.INCLUDED,
    });

    const grossAmount = items.reduce((acc, i) => acc + i.teacherPayout, 0);
    const adjustmentAmount = items.reduce(
      (acc, i) => acc + (i.adjustedPayout - i.teacherPayout),
      0,
    );

    const payroll = await this.payrollModel.findById(payrollId);
    if (!payroll) return;

    payroll.totalSessions = items.length;
    payroll.grossAmount = grossAmount;
    payroll.adjustmentAmount = adjustmentAmount;
    payroll.netAmount =
      grossAmount + adjustmentAmount + payroll.bonusAmount - payroll.deductionAmount;

    await payroll.save();
  }
}
