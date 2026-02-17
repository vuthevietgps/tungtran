import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, Connection } from 'mongoose';

import {
  StaffPayroll,
  StaffPayrollDocument,
  StaffPayrollStatus,
} from './schemas/staff-payroll.schema';
import { WorkSessionsService } from '../work-sessions/work-sessions.service';
import { SalaryConfigService } from '../salary-config/salary-config.service';
import { CommissionType } from '../salary-config/schemas/salary-config.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';

@Injectable()
export class StaffPayrollService {
  private readonly logger = new Logger(StaffPayrollService.name);

  constructor(
    @InjectModel(StaffPayroll.name) private staffPayrollModel: Model<StaffPayrollDocument>,
    @InjectConnection() private connection: Connection,
    private readonly workSessionsService: WorkSessionsService,
    private readonly salaryConfigService: SalaryConfigService,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  GENERATE (Tạo bảng lương nhân viên)
  // ══════════════════════════════════════════════════════════════════

  async generate(dto: {
    userId: string;
    periodStart: string;
    periodEnd: string;
    bonusAmount?: number;
    deductionAmount?: number;
    notes?: string;
  }, createdBy: string): Promise<StaffPayrollDocument> {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodEnd <= periodStart) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // Check duplicate
    const existing = await this.staffPayrollModel.findOne({
      userId: new Types.ObjectId(dto.userId),
      periodStart: { $lte: periodEnd },
      periodEnd: { $gte: periodStart },
      status: { $nin: [StaffPayrollStatus.REJECTED] },
    });
    if (existing) {
      throw new BadRequestException(
        `Đã tồn tại bảng lương cho nhân viên này trong kỳ trùng (${existing.payrollCode})`,
      );
    }

    // 1. Lấy SalaryConfig
    const config = await this.salaryConfigService.findByUserId(dto.userId);
    if (!config) {
      throw new BadRequestException('Chưa cấu hình lương cho nhân viên này');
    }

    // 2. Lấy thông tin user
    const UserModel = this.connection.model('User');
    const user = await UserModel.findById(dto.userId).lean() as any;
    if (!user) throw new NotFoundException('Nhân viên không tồn tại');

    // 3. Tổng hợp WorkSession → giờ làm + lần muộn
    const workSummary = await this.workSessionsService.getSummary(
      dto.userId, periodStart, periodEnd,
    );

    const actualHours = workSummary.totalHours;
    const standardHours = config.standardHours;
    const attendanceRatio = Math.min(actualHours / standardHours, 1);
    const baseSalaryAmount = Math.round(config.baseSalary * attendanceRatio);

    // 4. Tính hoa hồng (từ Orders approved/completed trong kỳ)
    let totalRevenue = 0;
    let commissionAmount = 0;
    if (config.commissionEnabled && config.commissionTiers.length > 0) {
      totalRevenue = await this.getRevenueForUser(dto.userId, periodStart, periodEnd);
      commissionAmount = this.calculateCommission(
        totalRevenue,
        config.commissionType as CommissionType,
        config.commissionTiers,
      );
    }

    // 5. Tính KPI bonus
    let kpiScore = 0;
    let kpiBonusPercentage = 0;
    let kpiBonusAmount = 0;
    if (config.kpiBonusEnabled && config.kpiBonusTiers.length > 0) {
      kpiScore = await this.getKpiScore(dto.userId, user.role, periodStart, periodEnd);
      kpiBonusPercentage = this.findKpiBonusPercentage(kpiScore, config.kpiBonusTiers);
      kpiBonusAmount = Math.round(config.baseSalary * kpiBonusPercentage / 100);
    }

    // 6. Tính phạt muộn
    const lateDays = workSummary.lateDays;
    const latePenaltyPerTime = config.latePenaltyAmount;
    const latePenaltyAmount = lateDays * latePenaltyPerTime;

    // 7. Điều chỉnh thủ công
    const bonusAmount = dto.bonusAmount ?? 0;
    const deductionAmount = dto.deductionAmount ?? 0;

    // 8. Tổng thực nhận
    const netAmount = baseSalaryAmount + commissionAmount + kpiBonusAmount
      - latePenaltyAmount + bonusAmount - deductionAmount;

    // 9. Tạo mã bảng lương
    const ym = `${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
    const shortId = dto.userId.slice(-6).toUpperCase();
    const payrollCode = `SPR-${ym}-${shortId}`;

    const payroll = await this.staffPayrollModel.create({
      userId: new Types.ObjectId(dto.userId),
      userName: user.fullName,
      role: user.role,
      periodStart,
      periodEnd,
      payrollCode,

      baseSalary: config.baseSalary,
      standardHours,
      actualHours,
      attendanceRatio: Math.round(attendanceRatio * 10000) / 10000,
      baseSalaryAmount,

      totalRevenue,
      commissionType: config.commissionType,
      commissionTiers: config.commissionTiers,
      commissionAmount,

      kpiScore: Math.round(kpiScore * 100) / 100,
      kpiBonusTiers: config.kpiBonusTiers,
      kpiBonusPercentage,
      kpiBonusAmount,

      lateDays,
      latePenaltyPerTime,
      latePenaltyAmount,

      bonusAmount,
      deductionAmount,
      notes: dto.notes,

      netAmount,
      status: StaffPayrollStatus.DRAFT,
      createdBy: new Types.ObjectId(createdBy),
    });

    this.logger.log(
      `Staff payroll generated: ${payrollCode} | user=${user.fullName} | net=${netAmount}đ`,
    );
    return payroll;
  }

  // ══════════════════════════════════════════════════════════════════
  //  BULK GENERATE
  // ══════════════════════════════════════════════════════════════════

  async bulkGenerate(
    periodStart: string,
    periodEnd: string,
    createdBy: string,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    // Lấy tất cả user có SalaryConfig ACTIVE
    const configs = await this.salaryConfigService.findAll({ status: 'ACTIVE', limit: 1000 });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const config of configs.data) {
      try {
        const userId = (config.userId as any)?._id?.toString() || config.userId?.toString();
        await this.generate({ userId, periodStart, periodEnd }, createdBy);
        created++;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Đã tồn tại')) {
          skipped++;
        } else {
          const userName = (config.userId as any)?.fullName || 'N/A';
          errors.push(`${userName}: ${msg}`);
        }
      }
    }

    return { created, skipped, errors };
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUERY
  // ══════════════════════════════════════════════════════════════════

  async findAll(query: {
    userId?: string;
    status?: StaffPayrollStatus;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: FilterQuery<StaffPayroll> = {};

    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.status) filter.status = query.status;
    if (query.fromDate || query.toDate) {
      filter.periodStart = {};
      if (query.fromDate) filter.periodStart.$gte = new Date(query.fromDate);
      if (query.toDate) filter.periodStart.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.staffPayrollModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email role')
        .populate('createdBy', 'fullName')
        .populate('approvedBy', 'fullName')
        .lean(),
      this.staffPayrollModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, actor?: JwtPayload): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel
      .findById(id)
      .populate('userId', 'fullName email role')
      .populate('createdBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('paidBy', 'fullName');

    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');

    // Staff can only view their own
    if (actor && ![Role.DIRECTOR, Role.ACCOUNTING, Role.OPS].includes(actor.role)) {
      if (payroll.userId?.toString() !== actor.sub) {
        throw new BadRequestException('Bạn không có quyền xem bảng lương này');
      }
    }
    return payroll;
  }

  // ══════════════════════════════════════════════════════════════════
  //  UPDATE (chỉ DRAFT)
  // ══════════════════════════════════════════════════════════════════

  async update(id: string, dto: {
    bonusAmount?: number;
    deductionAmount?: number;
    notes?: string;
  }): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ sửa được bảng lương DRAFT');
    }

    if (dto.bonusAmount !== undefined) payroll.bonusAmount = dto.bonusAmount;
    if (dto.deductionAmount !== undefined) payroll.deductionAmount = dto.deductionAmount;
    if (dto.notes !== undefined) payroll.notes = dto.notes;

    // Recalc net
    payroll.netAmount =
      payroll.baseSalaryAmount +
      payroll.commissionAmount +
      payroll.kpiBonusAmount -
      payroll.latePenaltyAmount +
      payroll.bonusAmount -
      payroll.deductionAmount;

    return payroll.save();
  }

  // ══════════════════════════════════════════════════════════════════
  //  WORKFLOW: SUBMIT → APPROVE → PAY
  // ══════════════════════════════════════════════════════════════════

  async submitForReview(id: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ submit được bảng lương DRAFT');
    }
    payroll.status = StaffPayrollStatus.PENDING_REVIEW;
    return payroll.save();
  }

  async approve(id: string, approvedBy: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.PENDING_REVIEW) {
      throw new BadRequestException('Chỉ duyệt được bảng lương PENDING_REVIEW');
    }
    payroll.status = StaffPayrollStatus.APPROVED;
    payroll.approvedBy = new Types.ObjectId(approvedBy);
    payroll.approvedAt = new Date();
    return payroll.save();
  }

  async reject(id: string, rejectedBy: string, reason: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.PENDING_REVIEW) {
      throw new BadRequestException('Chỉ từ chối được bảng lương PENDING_REVIEW');
    }
    payroll.status = StaffPayrollStatus.REJECTED;
    payroll.rejectionReason = reason;
    payroll.approvedBy = new Types.ObjectId(rejectedBy);
    payroll.approvedAt = new Date();
    return payroll.save();
  }

  async reopen(id: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.REJECTED) {
      throw new BadRequestException('Chỉ mở lại được bảng lương REJECTED');
    }
    payroll.status = StaffPayrollStatus.DRAFT;
    payroll.rejectionReason = undefined;
    payroll.approvedBy = undefined;
    payroll.approvedAt = undefined;
    return payroll.save();
  }

  async markPaid(id: string, paidBy: string, paymentRef?: string): Promise<StaffPayrollDocument> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.APPROVED) {
      throw new BadRequestException('Chỉ chi lương được bảng lương APPROVED');
    }
    payroll.status = StaffPayrollStatus.PAID;
    payroll.paidAt = new Date();
    payroll.paidBy = new Types.ObjectId(paidBy);
    if (paymentRef) payroll.paymentRef = paymentRef;
    return payroll.save();
  }

  async remove(id: string): Promise<void> {
    const payroll = await this.staffPayrollModel.findById(id);
    if (!payroll) throw new NotFoundException('Bảng lương không tồn tại');
    if (payroll.status !== StaffPayrollStatus.DRAFT) {
      throw new BadRequestException('Chỉ xóa được bảng lương DRAFT');
    }
    await this.staffPayrollModel.findByIdAndDelete(id);
  }

  // ══════════════════════════════════════════════════════════════════
  //  STATS
  // ══════════════════════════════════════════════════════════════════

  async getSummary() {
    return this.staffPayrollModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalNet: { $sum: '$netAmount' },
        },
      },
    ]);
  }

  // ══════════════════════════════════════════════════════════════════
  //  HELPERS: Tính toán lương
  // ══════════════════════════════════════════════════════════════════

  /**
   * Lấy doanh thu từ Orders (approved/completed) gán cho user trong kỳ.
   */
  private async getRevenueForUser(userId: string, from: Date, to: Date): Promise<number> {
    const OrderModel = this.connection.model('Order');
    const result = await OrderModel.aggregate([
      {
        $match: {
          saleId: new Types.ObjectId(userId),
          status: { $in: ['APPROVED', 'COMPLETED'] },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
        },
      },
    ]);
    return result[0]?.totalRevenue || 0;
  }

  /**
   * Tính hoa hồng dựa trên doanh thu + bảng mốc + kiểu tính.
   */
  private calculateCommission(
    totalRevenue: number,
    commissionType: CommissionType,
    tiers: Array<{ minRevenue: number; maxRevenue: number | null; percentage: number }>,
  ): number {
    if (totalRevenue <= 0 || tiers.length === 0) return 0;

    // Sort tiers by minRevenue ascending
    const sorted = [...tiers].sort((a, b) => a.minRevenue - b.minRevenue);

    if (commissionType === CommissionType.HIGHEST_TIER) {
      // Mốc cao nhất: tìm mốc cao nhất mà revenue đạt được → toàn bộ revenue × %
      let applicablePercentage = 0;
      for (const tier of sorted) {
        if (totalRevenue >= tier.minRevenue) {
          applicablePercentage = tier.percentage;
        }
      }
      return Math.round(totalRevenue * applicablePercentage / 100);
    }

    // PROGRESSIVE: lũy tiến — mỗi phần doanh thu trong khoảng tính % riêng
    let commission = 0;
    for (const tier of sorted) {
      const min = tier.minRevenue;
      const max = tier.maxRevenue ?? Infinity;

      if (totalRevenue <= min) break;

      const taxableAmount = Math.min(totalRevenue, max) - min;
      if (taxableAmount > 0) {
        commission += taxableAmount * tier.percentage / 100;
      }
    }
    return Math.round(commission);
  }

  /**
   * Lấy KPI score cho user.
   * - Teacher: tính từ sessions (completion rate, report rate, ratings, etc.)
   * - Các role khác: tính đơn giản từ attendance ratio × 100
   */
  private async getKpiScore(
    userId: string,
    role: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    if (role === 'TEACHER') {
      return this.getTeacherKpiScore(userId, from, to);
    }

    // Các role khác: KPI đơn giản dựa trên attendance
    // Có thể mở rộng sau
    const workSummary = await this.workSessionsService.getSummary(userId, from, to);
    const config = await this.salaryConfigService.findByUserId(userId);
    if (!config) return 0;

    const attendanceRatio = Math.min(workSummary.totalHours / config.standardHours, 1);
    return Math.round(attendanceRatio * 100);
  }

  /**
   * Tính KPI score cho teacher (cùng công thức với dashboard.getTeacherKPI).
   */
  private async getTeacherKpiScore(teacherId: string, from: Date, to: Date): Promise<number> {
    const SessionModel = this.connection.model('Session');

    const sessions = await SessionModel.find({
      teacherId: new Types.ObjectId(teacherId),
      scheduledDate: { $gte: from, $lte: to },
    }).lean() as any[];

    if (sessions.length === 0) return 0;

    const total = sessions.length;
    const completed = sessions.filter((s: any) =>
      ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(s.status),
    ).length;
    const completionRate = (completed / total) * 100;

    const withReport = sessions.filter((s: any) => s.hasTeachingReport).length;
    const reportSubmissionRate = completed > 0 ? (withReport / completed) * 100 : 0;

    const reportsWithTime = sessions.filter(
      (s: any) => s.teachingReport?.submittedAt && !s.teachingReport?.isLateSubmission,
    ).length;
    const onTimeReportRate = withReport > 0 ? (reportsWithTime / withReport) * 100 : 0;

    // Parent feedback averages
    const withFeedback = sessions.filter((s: any) => s.parentFeedback?.overallRating);
    const avgOverallRating = withFeedback.length > 0
      ? withFeedback.reduce((acc: number, s: any) => acc + s.parentFeedback.overallRating, 0) / withFeedback.length
      : 3; // default neutral

    // Student evaluation averages
    const withEvaluation = sessions.filter((s: any) => s.evaluation?.studentPerformance);
    const avgStudentPerformance = withEvaluation.length > 0
      ? withEvaluation.reduce((acc: number, s: any) => acc + s.evaluation.studentPerformance, 0) / withEvaluation.length
      : 3;

    const satisfactionRate = withFeedback.length > 0
      ? (withFeedback.filter((s: any) => s.parentFeedback.isSatisfied).length / withFeedback.length) * 100
      : 50;

    // KPI formula (same as dashboard)
    const kpiScore =
      completionRate * 0.25 +
      reportSubmissionRate * 0.15 +
      onTimeReportRate * 0.10 +
      avgOverallRating * 20 * 0.25 +
      avgStudentPerformance * 20 * 0.15 +
      satisfactionRate * 0.10;

    return Math.min(kpiScore, 100);
  }

  /**
   * Tìm mốc KPI bonus phù hợp với score.
   */
  private findKpiBonusPercentage(
    kpiScore: number,
    tiers: Array<{ minScore: number; maxScore: number; bonusPercentage: number }>,
  ): number {
    for (const tier of tiers) {
      if (kpiScore >= tier.minScore && kpiScore <= tier.maxScore) {
        return tier.bonusPercentage;
      }
    }
    return 0;
  }
}
