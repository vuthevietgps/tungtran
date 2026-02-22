import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TeacherProfile, TeacherProfileDocument, TeacherStatus } from './schemas/teacher-profile.schema';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Payroll, PayrollDocument } from '../payroll/schemas/payroll.schema';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class TeachersService {
  constructor(
    @InjectModel(TeacherProfile.name) private readonly teacherProfileModel: Model<TeacherProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Payroll.name) private readonly payrollModel: Model<PayrollDocument>,
  ) {}

  async create(dto: CreateTeacherProfileDto, actor: JwtPayload): Promise<TeacherProfile> {
    // Check if user exists and has TEACHER role
    const user = await this.userModel.findById(dto.userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }
    if (user.role !== Role.TEACHER) {
      throw new BadRequestException('Tài khoản phải có vai trò TEACHER');
    }

    // Check if profile already exists
    const existing = await this.teacherProfileModel.findOne({ userId: dto.userId });
    if (existing) {
      throw new ConflictException('Hồ sơ giáo viên đã tồn tại cho tài khoản này');
    }

    const profile = new this.teacherProfileModel({
      ...dto,
      userId: new Types.ObjectId(dto.userId),
    });
    return profile.save();
  }

  async findAll(filters?: { status?: TeacherStatus; subjects?: string[]; grades?: string[] }): Promise<TeacherProfile[]> {
    const query: any = {};
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.subjects?.length) {
      query.subjects = { $in: filters.subjects };
    }
    if (filters?.grades?.length) {
      query.grades = { $in: filters.grades };
    }

    return this.teacherProfileModel
      .find(query)
      .populate('userId', 'fullName email')
      .populate('approvedBy', 'fullName')
      .sort({ rating: -1, createdAt: -1 })
      .lean();
  }

  async findOne(id: string, actor?: JwtPayload): Promise<TeacherProfile> {
    const profile = await this.teacherProfileModel
      .findById(id)
      .populate('userId', 'fullName email phone')
      .populate('approvedBy', 'fullName')
      .lean();
    if (!profile) {
      throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
    }
    // TEACHER can only view their own profile; staff roles can view any
    if (actor?.role === Role.TEACHER) {
      if ((profile as any).userId?._id?.toString() !== actor.sub &&
          (profile as any).userId?.toString() !== actor.sub) {
        throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
      }
    }
    return profile;
  }

  async findByUserId(userId: string): Promise<TeacherProfile | null> {
    return this.teacherProfileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'fullName email')
      .lean();
  }

  async update(id: string, dto: UpdateTeacherProfileDto, actor: JwtPayload): Promise<TeacherProfile> {
    // TEACHER can only update their own profile
    if (actor?.role === Role.TEACHER) {
      const profile = await this.teacherProfileModel.findById(id).select('userId').lean() as any;
      if (!profile) throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
      if (profile.userId?.toString() !== actor.sub) {
        throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
      }
      // Strip ALL system-managed fields — only allow teacher-editable fields
      const allowedFields = [
        'subjects', 'grades', 'teachingMode', 'locations', 'bio',
        'qualifications', 'yearsOfExperience', 'videoIntroUrl', 'availability',
        'pricePerSession', 'pricePerHour', 'bankInfo',
      ];
      for (const key of Object.keys(dto)) {
        if (!allowedFields.includes(key)) {
          delete (dto as any)[key];
        }
      }
    }
    const updated = await this.teacherProfileModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('userId', 'fullName email')
      .populate('approvedBy', 'fullName')
      .lean();
    if (!updated) {
      throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
    }
    return updated;
  }

  async approve(id: string, actor: JwtPayload): Promise<TeacherProfile> {
    const updated = await this.teacherProfileModel
      .findOneAndUpdate(
        { _id: id, status: TeacherStatus.PENDING },
        {
          status: TeacherStatus.APPROVED,
          approvedBy: actor._id,
          approvedAt: new Date(),
        },
        { new: true },
      )
      .populate('userId', 'fullName email')
      .lean();
    if (!updated) {
      const exists = await this.teacherProfileModel.findById(id).select('status').lean();
      if (!exists) throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
      throw new BadRequestException(`Chỉ duyệt được hồ sơ PENDING, hiện tại: ${exists.status}`);
    }
    return updated;
  }

  async activate(id: string): Promise<TeacherProfile> {
    // Only APPROVED or SUSPENDED can be activated
    const updated = await this.teacherProfileModel
      .findOneAndUpdate(
        { _id: id, status: { $in: [TeacherStatus.APPROVED, TeacherStatus.SUSPENDED, TeacherStatus.INACTIVE] } },
        { status: TeacherStatus.ACTIVE },
        { new: true },
      )
      .populate('userId', 'fullName email')
      .lean();
    if (!updated) {
      const exists = await this.teacherProfileModel.findById(id).select('status').lean();
      if (!exists) throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
      throw new BadRequestException(`Không thể kích hoạt hồ sơ ở trạng thái ${exists.status}`);
    }
    return updated;
  }

  async suspend(id: string, reason?: string): Promise<TeacherProfile> {
    // Only ACTIVE or APPROVED can be suspended
    const updated = await this.teacherProfileModel
      .findOneAndUpdate(
        { _id: id, status: { $in: [TeacherStatus.ACTIVE, TeacherStatus.APPROVED] } },
        {
          status: TeacherStatus.SUSPENDED,
          adminNotes: reason,
        },
        { new: true },
      )
      .populate('userId', 'fullName email')
      .lean();
    if (!updated) {
      const exists = await this.teacherProfileModel.findById(id).select('status').lean();
      if (!exists) throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
      throw new BadRequestException(`Không thể tạm ngưng hồ sơ ở trạng thái ${exists.status}`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const profile = await this.teacherProfileModel.findById(id).lean() as any;
    if (!profile) throw new NotFoundException('Hồ sơ giáo viên không tồn tại');

    // Check for active classes or pending payrolls
    const [activeClasses, pendingPayrolls] = await Promise.all([
      this.classModel.countDocuments({ teacher: profile.userId, status: 'ACTIVE' }),
      this.payrollModel.countDocuments({ teacherId: profile.userId, status: { $in: ['PENDING', 'APPROVED'] } }),
    ]);
    if (activeClasses > 0) {
      throw new BadRequestException(`Giáo viên đang có ${activeClasses} lớp ACTIVE, không thể xoá`);
    }
    if (pendingPayrolls > 0) {
      throw new BadRequestException(`Giáo viên đang có ${pendingPayrolls} bảng lương chưa xử lý, không thể xoá`);
    }

    await this.teacherProfileModel.findByIdAndDelete(id);
  }

  // ══════════════════════════════════════════════════════════════════
  //  STATS & FULL PROFILE
  // ══════════════════════════════════════════════════════════════════

  /**
   * Thống kê tổng quan giáo viên:
   * - Tổng số GV, phân theo status
   * - Trung bình rating
   * - Tổng buổi đã dạy
   */
  async getStats() {
    const [byStatus, aggregates] = await Promise.all([
      // Đếm theo status
      this.teacherProfileModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Tổng hợp metrics
      this.teacherProfileModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            avgRating: { $avg: '$rating' },
            totalSessions: { $sum: '$totalSessions' },
            totalActiveClasses: { $sum: '$activeClasses' },
            avgExperience: { $avg: '$yearsOfExperience' },
          },
        },
      ]),
    ]);

    // Flatten byStatus vào object
    const statusCounts: Record<string, number> = {};
    for (const s of byStatus) {
      statusCounts[s._id] = s.count;
    }

    const agg = aggregates[0] || {
      total: 0,
      avgRating: 0,
      totalSessions: 0,
      totalActiveClasses: 0,
      avgExperience: 0,
    };

    return {
      total: agg.total,
      byStatus: statusCounts,
      avgRating: Math.round((agg.avgRating || 0) * 10) / 10,
      totalSessions: agg.totalSessions,
      totalActiveClasses: agg.totalActiveClasses,
      avgYearsOfExperience: Math.round((agg.avgExperience || 0) * 10) / 10,
    };
  }

  /**
   * Profile đầy đủ của giáo viên:
   * - Thông tin cá nhân + profile
   * - Danh sách lớp đang dạy & đã dạy
   * - Thống kê buổi học (theo status)
   * - Tổng thu nhập từ payroll
   */
  async getFullProfile(profileId: string, actor?: JwtPayload) {
    const profile = await this.teacherProfileModel
      .findById(profileId)
      .populate('userId', 'fullName email phone role status')
      .populate('approvedBy', 'fullName')
      .lean();
    if (!profile) {
      throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
    }

    // TEACHER can only view their own full profile (includes earnings, bank info)
    if (actor?.role === Role.TEACHER) {
      const profileUserId = (profile.userId as any)?._id?.toString() || profile.userId?.toString();
      if (profileUserId !== actor.sub) {
        throw new NotFoundException('Hồ sơ giáo viên không tồn tại');
      }
    }

    const userId = profile.userId as any;
    const teacherUserId = userId._id || profile.userId;

    // Chạy song song: lớp, session stats, payroll
    const [classes, sessionStats, recentSessions, payrollSummary] = await Promise.all([
      // Danh sách lớp (đang dạy + đã hoàn thành)
      this.classModel
        .find({ teacher: teacherUserId })
        .select('name code status classMode pricePerSession teacherPayPerSession teacherPayPerStudent students schedule createdAt')
        .populate('students', 'fullName studentCode')
        .sort({ createdAt: -1 })
        .lean(),

      // Thống kê buổi học theo status
      this.sessionModel.aggregate([
        { $match: { teacherId: new Types.ObjectId(teacherUserId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPayout: { $sum: '$teacherPayout' },
          },
        },
      ]),

      // 10 buổi học gần nhất
      this.sessionModel
        .find({ teacherId: teacherUserId })
        .select('classId studentId status scheduledDate teacherPayout sessionType')
        .populate('classId', 'name code')
        .populate('studentId', 'fullName studentCode')
        .sort({ scheduledDate: -1 })
        .limit(10)
        .lean(),

      // Tổng thu nhập qua payroll
      this.payrollModel.aggregate([
        { $match: { teacherId: new Types.ObjectId(teacherUserId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            // Keep API field name `totalAmount` for compatibility, but sum the real payroll field.
            totalAmount: { $sum: '$netAmount' },
          },
        },
      ]),
    ]);

    // Parse session stats
    const sessionSummary: Record<string, { count: number; totalPayout: number }> = {};
    let totalSessionCount = 0;
    let totalEarningsFromSessions = 0;
    for (const s of sessionStats) {
      sessionSummary[s._id] = { count: s.count, totalPayout: s.totalPayout || 0 };
      totalSessionCount += s.count;
      totalEarningsFromSessions += s.totalPayout || 0;
    }

    // Parse payroll summary
    const payroll: Record<string, { count: number; totalAmount: number }> = {};
    let totalPaid = 0;
    for (const p of payrollSummary) {
      payroll[p._id] = { count: p.count, totalAmount: p.totalAmount || 0 };
      if (p._id === 'PAID') totalPaid += p.totalAmount || 0;
    }

    // Tách lớp đang dạy vs đã xong
    const activeClasses = classes.filter((c: any) => c.status === 'ACTIVE');
    const completedClasses = classes.filter((c: any) => c.status !== 'ACTIVE');

    return {
      profile,
      classes: {
        active: activeClasses,
        completed: completedClasses,
        totalActive: activeClasses.length,
        totalCompleted: completedClasses.length,
      },
      sessions: {
        byStatus: sessionSummary,
        totalCount: totalSessionCount,
        totalEarnings: totalEarningsFromSessions,
        recent: recentSessions,
      },
      payroll: {
        byStatus: payroll,
        totalPaid,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  HELPERS (incremental stats update)
  // ══════════════════════════════════════════════════════════════════

  // Update stats after session
  async incrementSessionCount(userId: string): Promise<void> {
    await this.teacherProfileModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $inc: { totalSessions: 1 } },
    );
  }

  async updateActiveClassCount(userId: string, count: number): Promise<void> {
    await this.teacherProfileModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { activeClasses: count },
    );
  }

  async updateRating(userId: string, newRating: number): Promise<void> {
    // Atomic: increment totalReviews AND compute new rating in one operation
    // Uses $inc for totalReviews and recalculates via aggregation-style update
    const profile = await this.teacherProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      [
        {
          $set: {
            totalReviews: { $add: ['$totalReviews', 1] },
            rating: {
              $round: [
                {
                  $divide: [
                    { $add: [{ $multiply: ['$rating', '$totalReviews'] }, newRating] },
                    { $add: ['$totalReviews', 1] },
                  ],
                },
                1,
              ],
            },
          },
        },
      ],
      { new: true },
    );
    // No error if profile not found — caller handles gracefully
  }
}
