import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Session, SessionDocument, SessionStatus, CancelledByRole } from './schemas/session.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';

import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { CompleteSessionDto } from './dto/complete-session.dto';
import { ConfirmSessionDto } from './dto/confirm-session.dto';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { RescheduleSessionDto } from './dto/reschedule-session.dto';
import { BulkCreateSessionDto } from './dto/bulk-create-session.dto';
import { SubmitTeachingReportDto } from './dto/submit-teaching-report.dto';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @Inject(forwardRef(() => WalletsService))
    private walletsService: WalletsService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  //  CREATE
  // ──────────────────────────────────────────────────────────────────

  async create(dto: CreateSessionDto, createdBy: string): Promise<SessionDocument> {
    // Validate class exists
    const classroom = await this.classModel.findById(dto.classId).lean();
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    // Validate student exists
    const student = await this.studentModel.findById(dto.studentId).lean();
    if (!student) throw new NotFoundException('Học sinh không tồn tại');

    // Check for duplicate session (same student + class + date)
    const scheduledDate = new Date(dto.scheduledDate);
    const dayStart = new Date(Date.UTC(scheduledDate.getUTCFullYear(), scheduledDate.getUTCMonth(), scheduledDate.getUTCDate()));
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const duplicate = await this.sessionModel.findOne({
      classId: dto.classId,
      studentId: dto.studentId,
      scheduledDate: { $gte: dayStart, $lt: dayEnd },
      status: { $nin: [SessionStatus.CANCELLED, SessionStatus.RESCHEDULED] },
    }).lean();
    if (duplicate) {
      throw new ConflictException('Đã tồn tại buổi học cho học sinh này trong lớp vào ngày này');
    }

    // ── Schedule Conflict Detection ──
    if (dto.scheduledStartTime && dto.scheduledEndTime) {
      const conflictResult = await this.checkConflicts({
        teacherId: dto.teacherId,
        studentId: dto.studentId,
        scheduledDate: dto.scheduledDate,
        scheduledStartTime: dto.scheduledStartTime,
        scheduledEndTime: dto.scheduledEndTime,
      });
      if (conflictResult.hasConflict) {
        const msgs = conflictResult.conflicts.map((c: any) => c.message).join('; ');
        throw new ConflictException(`Trùng lịch: ${msgs}`);
      }
    }

    // Auto-fill financials from class — tỷ lệ theo thời lượng
    const baseDuration = (classroom as any).baseDuration || 60;
    const durationMinutes = dto.durationMinutes ?? classroom.sessionDuration ?? 60;
    const ratio = durationMinutes / baseDuration;
    const amountCharged = dto.amountCharged ?? Math.round((classroom.pricePerSession ?? 0) * ratio);
    const teacherPayout = dto.teacherPayout ?? Math.round((classroom.teacherPayPerSession ?? 0) * ratio);
    const parentUserId = dto.parentUserId ?? student.parentUserId?.toString();

    // Build evaluation nếu có mục tiêu buổi học
    const evaluation = dto.lessonObjective
      ? { lessonObjective: dto.lessonObjective }
      : undefined;

    const session = new this.sessionModel({
      ...dto,
      scheduledDate: new Date(dto.scheduledDate),
      parentUserId: parentUserId ? new Types.ObjectId(parentUserId) : undefined,
      sessionType: dto.sessionType,
      amountCharged,
      teacherPayout,
      durationMinutes,
      evaluation,
      orderId: (student as any).orderId || undefined,
      adGroupId: (student as any).adGroupId || undefined,
      adGroupName: (student as any).adGroupName || undefined,
      createdBy: new Types.ObjectId(createdBy),
    });

    return session.save();
  }

  // ──────────────────────────────────────────────────────────────────
  //  BULK CREATE (tạo cho cả lớp)
  // ──────────────────────────────────────────────────────────────────

  async bulkCreate(dto: BulkCreateSessionDto, createdBy: string): Promise<SessionDocument[]> {
    const classroom = await this.classModel.findById(dto.classId).lean();
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    const sessions: SessionDocument[] = [];

    for (const item of dto.students) {
      try {
        const session = await this.create(
          {
            classId: dto.classId,
            teacherId: dto.teacherId,
            studentId: item.studentId,
            parentUserId: item.parentUserId,
            scheduledDate: dto.scheduledDate,
            durationMinutes: dto.durationMinutes,
            sessionType: dto.sessionType,
            scheduledStartTime: dto.scheduledStartTime,
            scheduledEndTime: dto.scheduledEndTime,
          },
          createdBy,
        );
        sessions.push(session);
      } catch (err) {
        this.logger.warn(
          `Bulk create skipped student ${item.studentId}: ${(err as Error).message}`,
        );
      }
    }

    return sessions;
  }

  // ──────────────────────────────────────────────────────────────────
  //  QUERY / FIND
  // ──────────────────────────────────────────────────────────────────

  async findAll(query: QuerySessionDto) {
    const filter: FilterQuery<Session> = {};

    if (query.classId) filter.classId = new Types.ObjectId(query.classId);
    if (query.studentId) filter.studentId = new Types.ObjectId(query.studentId);
    if (query.teacherId) filter.teacherId = new Types.ObjectId(query.teacherId);
    if (query.parentUserId) filter.parentUserId = new Types.ObjectId(query.parentUserId);
    if (query.status) filter.status = query.status;

    // Lọc theo báo cáo giảng dạy
    if ((query as any).hasReport === 'true') filter.hasTeachingReport = true;
    if ((query as any).hasReport === 'false') {
      filter.hasTeachingReport = { $ne: true } as any;
      // Chỉ lọc các status hợp lệ (đã dạy rồi)
      if (!query.status) {
        filter.status = { $in: [
          SessionStatus.TEACHER_COMPLETED,
          SessionStatus.PARENT_CONFIRMED,
          SessionStatus.FINALIZED,
        ] } as any;
      }
    }

    if (query.fromDate || query.toDate) {
      filter.scheduledDate = {};
      if (query.fromDate) filter.scheduledDate.$gte = new Date(query.fromDate);
      if (query.toDate) filter.scheduledDate.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-scheduledDate';

    const [data, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('classId', 'name code')
        .populate('studentId', 'fullName studentCode')
        .populate('teacherId', 'fullName email')
        .lean(),
      this.sessionModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, actor?: JwtPayload): Promise<SessionDocument> {
    const session = await this.sessionModel
      .findById(id)
      .populate('classId', 'name code pricePerSession teacherPayPerSession cancelPolicy')
      .populate('studentId', 'fullName studentCode parentUserId parentName parentPhone')
      .populate('teacherId', 'fullName email phone')
      .populate('parentUserId', 'fullName email phone')
      .populate('createdBy', 'fullName');

    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    // Ownership check for PARENT and TEACHER
    if (actor?.role === Role.PARENT) {
      if (session.parentUserId?.toString() !== actor.sub &&
          (session.parentUserId as any)?._id?.toString() !== actor.sub) {
        throw new NotFoundException('Buổi học không tồn tại');
      }
    } else if (actor?.role === Role.TEACHER) {
      if (session.teacherId?.toString() !== actor.sub &&
          (session.teacherId as any)?._id?.toString() !== actor.sub) {
        throw new NotFoundException('Buổi học không tồn tại');
      }
    }

    return session;
  }

  // ──────────────────────────────────────────────────────────────────
  //  UPDATE (basic edit - only SCHEDULED sessions)
  // ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateSessionDto): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(id);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chỉ có thể sửa buổi học ở trạng thái SCHEDULED',
      );
    }

    Object.assign(session, dto);
    if (dto.scheduledDate) session.scheduledDate = new Date(dto.scheduledDate);
    return session.save();
  }

  // ──────────────────────────────────────────────────────────────────
  //  TEACHER COMPLETE  (SCHEDULED → TEACHER_COMPLETED)
  // ──────────────────────────────────────────────────────────────────

  async teacherComplete(
    sessionId: string,
    teacherUserId: string,
    dto: CompleteSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Không thể hoàn thành buổi học ở trạng thái ${session.status}`,
      );
    }

    // Verify teacher owns this session
    if (session.teacherId.toString() !== teacherUserId) {
      throw new ForbiddenException('Bạn không phải GV của buổi học này');
    }

    // Update legacy content
    if (dto.topicsCovered) session.topicsCovered = dto.topicsCovered;
    if (dto.homework) session.homework = dto.homework;
    if (dto.teacherNotes) session.teacherNotes = dto.teacherNotes;
    if (dto.actualStartTime) session.actualStartTime = new Date(dto.actualStartTime);
    if (dto.actualEndTime) session.actualEndTime = new Date(dto.actualEndTime);

    // Build evaluation (đánh giá buổi học chi tiết)
    const evaluation = session.evaluation || {} as any;
    if (dto.lessonObjective) evaluation.lessonObjective = dto.lessonObjective;
    if (dto.lessonContent) evaluation.lessonContent = dto.lessonContent;
    if (dto.materialsUsed) evaluation.materialsUsed = dto.materialsUsed;
    if (dto.skillsTaught) evaluation.skillsTaught = dto.skillsTaught;
    if (dto.studentPerformance) evaluation.studentPerformance = dto.studentPerformance;
    if (dto.studentEngagement) evaluation.studentEngagement = dto.studentEngagement;
    if (dto.comprehensionLevel) evaluation.comprehensionLevel = dto.comprehensionLevel;
    if (dto.strengthsObserved) evaluation.strengthsObserved = dto.strengthsObserved;
    if (dto.areasOfImprovement) evaluation.areasOfImprovement = dto.areasOfImprovement;
    if (dto.homeworkAssigned) {
      evaluation.homeworkAssigned = dto.homeworkAssigned;
      evaluation.homeworkStatus = 'ASSIGNED';
    }
    if (dto.homeworkDeadline) evaluation.homeworkDeadline = new Date(dto.homeworkDeadline);
    if (dto.progressPercent !== undefined) evaluation.progressPercent = dto.progressPercent;
    if (dto.curriculumItemsCompleted) evaluation.curriculumItemsCompleted = dto.curriculumItemsCompleted;
    if (dto.nextSessionPlan) evaluation.nextSessionPlan = dto.nextSessionPlan;
    if (dto.overallComment) evaluation.overallComment = dto.overallComment;
    session.evaluation = evaluation;

    // Status transition
    session.status = SessionStatus.TEACHER_COMPLETED;
    session.confirmation.teacherCompletedAt = new Date();

    return session.save();
  }

  // ──────────────────────────────────────────────────────────────────
  //  TEACHING REPORT (Báo cáo giảng dạy — bắt buộc để tính lương)
  // ──────────────────────────────────────────────────────────────────

  /**
   * GV nộp báo cáo giảng dạy cho 1 buổi học.
   * Deadline: trong vòng 24h sau buổi học.
   * Nộp muộn sẽ bị đánh dấu và cảnh báo.
   * Chỉ sessions có teachingReport mới được tính lương.
   */
  async submitTeachingReport(
    sessionId: string,
    teacherUserId: string,
    dto: SubmitTeachingReportDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    // Chỉ GV của buổi học mới được nộp báo cáo
    if (session.teacherId.toString() !== teacherUserId) {
      throw new ForbiddenException('Bạn không phải GV của buổi học này');
    }

    // Chỉ cho phép nộp báo cáo cho buổi đã hoàn thành
    const allowedForReport = [SessionStatus.TEACHER_COMPLETED, SessionStatus.FINALIZED];
    if (!allowedForReport.includes(session.status)) {
      throw new BadRequestException(
        'Chỉ nộp báo cáo cho buổi học đã hoàn thành',
      );
    }

    // Tính deadline (24h sau scheduledDate)
    const deadline = new Date(session.scheduledDate);
    deadline.setHours(deadline.getHours() + 24);

    const now = new Date();
    const isLate = now > deadline;
    const lateHours = isLate 
      ? Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60))
      : 0;

    // Kiểm tra nếu đã có báo cáo → update version
    const isUpdate = session.hasTeachingReport && session.teachingReport;
    const currentVersion = session.teachingReport?.version || 0;

    session.teachingReport = {
      lessonContent: dto.lessonContent,
      studentAttitude: dto.studentAttitude,
      recordingUrl: dto.recordingUrl,
      teacherComment: dto.teacherComment,
      homework: dto.homework,
      additionalNotes: dto.additionalNotes,
      submittedAt: isUpdate ? session.teachingReport!.submittedAt : now,
      deadline,
      isLateSubmission: isUpdate ? session.teachingReport!.isLateSubmission : isLate,
      lateSubmissionHours: isUpdate ? session.teachingReport!.lateSubmissionHours : lateHours,
      version: currentVersion + 1,
      lastUpdatedAt: now,
    };
    session.hasTeachingReport = true;

    // Log warning nếu nộp muộn
    if (isLate && !isUpdate) {
      this.logger.warn(
        `Late teaching report submission: Session ${sessionId} by teacher ${teacherUserId} - ${lateHours}h late`,
      );
    }

    this.logger.log(
      `Teaching report ${isUpdate ? 'updated' : 'submitted'} for session ${sessionId} by teacher ${teacherUserId} (version ${currentVersion + 1})`,
    );

    return session.save();
  }

  // ──────────────────────────────────────────────────────────────────
  //  PARENT CONFIRM  (TEACHER_COMPLETED → PARENT_CONFIRMED)
  // ──────────────────────────────────────────────────────────────────

  async parentConfirm(
    sessionId: string,
    parentUserId: string,
    dto: ConfirmSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.TEACHER_COMPLETED) {
      throw new BadRequestException(
        'Chỉ xác nhận được buổi học đã được GV hoàn thành',
      );
    }

    // Verify parent owns this student
    if (
      session.parentUserId &&
      session.parentUserId.toString() !== parentUserId
    ) {
      throw new ForbiddenException('Bạn không phải PH của học sinh này');
    }

    // Legacy fields
    if (dto.parentNotes) session.parentNotes = dto.parentNotes;
    if (dto.parentRating) session.parentRating = dto.parentRating;

    // Build parentFeedback (phản hồi chi tiết từ PH)
    const feedback = session.parentFeedback || {} as any;
    if (dto.parentNotes) feedback.parentNotes = dto.parentNotes;
    if (dto.overallRating) feedback.overallRating = dto.overallRating;
    if (dto.teachingQualityRating) feedback.teachingQualityRating = dto.teachingQualityRating;
    if (dto.communicationRating) feedback.communicationRating = dto.communicationRating;
    if (dto.concerns) feedback.concerns = dto.concerns;
    if (dto.isSatisfied !== undefined) feedback.isSatisfied = dto.isSatisfied;
    session.parentFeedback = feedback;

    // Auto-finalize on parent confirm — use atomic transition to prevent race with autoConfirm cron
    const updated = await this.sessionModel.findOneAndUpdate(
      { _id: sessionId, status: SessionStatus.TEACHER_COMPLETED },
      {
        $set: {
          status: SessionStatus.FINALIZED,
          parentNotes: dto.parentNotes || session.parentNotes,
          parentRating: dto.parentRating || session.parentRating,
          parentFeedback: session.parentFeedback,
          'confirmation.parentConfirmedAt': new Date(),
          'confirmation.finalizedAt': new Date(),
        },
      },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Buổi học đã được chốt bởi hệ thống');
    }

    // Trừ ví PH
    await this.deductWalletForSession(updated);

    return updated;
  }

  // ──────────────────────────────────────────────────────────────────
  //  OPS/DIRECTOR MANUAL FINALIZE
  // ──────────────────────────────────────────────────────────────────

  async manualFinalize(sessionId: string, userId: string): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    const allowedStatuses = [
      SessionStatus.TEACHER_COMPLETED,
      SessionStatus.PARENT_CONFIRMED,
    ];
    if (!allowedStatuses.includes(session.status)) {
      throw new BadRequestException(
        `Không thể chốt buổi học ở trạng thái ${session.status}`,
      );
    }

    // Atomic status transition để tránh double finalization
    const updated = await this.sessionModel.findOneAndUpdate(
      {
        _id: sessionId,
        status: { $in: [SessionStatus.TEACHER_COMPLETED, SessionStatus.PARENT_CONFIRMED] },
      },
      {
        $set: {
          status: SessionStatus.FINALIZED,
          'confirmation.finalizedAt': new Date(),
          'confirmation.finalizedBy': new Types.ObjectId(userId),
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException(
        'Buổi học đã được chốt bởi hệ thống hoặc người dùng khác',
      );
    }

    // Trừ ví PH
    await this.deductWalletForSession(updated);

    return updated;
  }

  // ──────────────────────────────────────────────────────────────────
  //  CANCEL SESSION
  // ──────────────────────────────────────────────────────────────────

  async cancel(
    sessionId: string,
    userId: string,
    userRole: Role,
    dto: CancelSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    // Cannot cancel already finalized/cancelled sessions
    if (
      [SessionStatus.FINALIZED, SessionStatus.CANCELLED, SessionStatus.RESCHEDULED].includes(
        session.status,
      )
    ) {
      throw new BadRequestException(
        `Không thể hủy buổi học ở trạng thái ${session.status}`,
      );
    }

    // PARENT cannot cancel sessions that teacher already completed
    if (userRole === Role.PARENT && session.status === SessionStatus.TEACHER_COMPLETED) {
      throw new BadRequestException(
        'Giáo viên đã hoàn thành buổi học, phụ huynh không thể hủy. Vui lòng liên hệ OPS.',
      );
    }

    // Determine who cancelled
    let cancelledByRole: CancelledByRole;
    if (userRole === Role.TEACHER) {
      cancelledByRole = CancelledByRole.TEACHER;
      // Verify teacher owns this session
      if (session.teacherId && session.teacherId.toString() !== userId) {
        throw new ForbiddenException('Bạn không phải giáo viên của buổi học này');
      }
    } else if (userRole === Role.PARENT) {
      cancelledByRole = CancelledByRole.PARENT;
      // Verify parent owns this student
      if (session.parentUserId && session.parentUserId.toString() !== userId) {
        throw new ForbiddenException('Bạn không phải phụ huynh của học sinh này');
      }
    } else {
      cancelledByRole = CancelledByRole.OPS;
    }

    // Calculate refund based on cancel policy from class
    const classroom = await this.classModel.findById(session.classId).lean();
    const policy = classroom?.cancelPolicy;
    const hoursBeforeSession = this.calcHoursBefore(session.scheduledDate, session.scheduledStartTime);
    const isLate = policy ? hoursBeforeSession < policy.hoursBeforeSession : false;

    let refundPercent = 100; // Full refund by default
    if (isLate && policy) {
      refundPercent = 100 - policy.lateChargePercent;
    }
    const refundAmount = Math.round(session.amountCharged * refundPercent / 100);

    session.status = SessionStatus.CANCELLED;
    session.cancellation = {
      cancelledBy: cancelledByRole,
      cancelledByUserId: new Types.ObjectId(userId),
      cancelReason: dto.cancelReason,
      cancelledAt: new Date(),
      refundPercent,
      refundAmount,
      isLateCancellation: isLate,
    };

    const saved = await session.save();

    // Hoàn tiền vào ví PH - CHIỄ KHI đã trừ tiền trước đó (isPaid = true)
    if (refundAmount > 0 && session.parentUserId && session.isPaid) {
      try {
        await this.walletsService.refundForSession({
          parentUserId: session.parentUserId.toString(),
          sessionId: saved._id.toString(),
          classId: session.classId.toString(),
          studentId: session.studentId.toString(),
          refundAmount,
        });
      } catch (err) {
        this.logger.warn(`Refund failed for session ${saved._id}: ${(err as Error).message}`);
      }
    }

    return saved;
  }

  // ──────────────────────────────────────────────────────────────────
  //  RESCHEDULE (dời lịch)
  // ──────────────────────────────────────────────────────────────────

  async reschedule(
    sessionId: string,
    userId: string,
    dto: RescheduleSessionDto,
  ): Promise<{ oldSession: SessionDocument; newSession: SessionDocument }> {
    const oldSession = await this.sessionModel.findById(sessionId);
    if (!oldSession) throw new NotFoundException('Buổi học không tồn tại');

    if (oldSession.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chỉ dời lịch được buổi ở trạng thái SCHEDULED',
      );
    }

    // Check max reschedules from class policy
    const classroom = await this.classModel.findById(oldSession.classId).lean();
    if (classroom?.cancelPolicy && !classroom.cancelPolicy.allowReschedule) {
      throw new BadRequestException('Lớp này không cho phép dời lịch');
    }

    // Create new session with new schedule
    const newSession = await this.create(
      {
        classId: oldSession.classId.toString(),
        studentId: oldSession.studentId.toString(),
        teacherId: oldSession.teacherId.toString(),
        parentUserId: oldSession.parentUserId?.toString(),
        scheduledDate: dto.newScheduledDate,
        scheduledStartTime: dto.newStartTime,
        scheduledEndTime: dto.newEndTime,
        durationMinutes: dto.durationMinutes ?? oldSession.durationMinutes,
        sessionType: (oldSession as any).sessionType,
        amountCharged: oldSession.amountCharged,
        teacherPayout: oldSession.teacherPayout,
        sessionNumber: oldSession.sessionNumber,
      },
      userId,
    );

    // Link old ↔ new
    newSession.rescheduledFromId = oldSession._id as Types.ObjectId;
    await newSession.save();

    oldSession.status = SessionStatus.RESCHEDULED;
    oldSession.rescheduledToId = newSession._id as Types.ObjectId;
    await oldSession.save();

    return { oldSession, newSession };
  }

  // ──────────────────────────────────────────────────────────────────
  //  MARK NO-SHOW
  // ──────────────────────────────────────────────────────────────────

  async markNoShow(sessionId: string): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chỉ đánh dấu vắng được buổi SCHEDULED',
      );
    }

    session.status = SessionStatus.NO_SHOW;
    const saved = await session.save();

    // NO_SHOW: deduct wallet if not already paid (student is charged for no-shows)
    if (!saved.isPaid && saved.parentUserId) {
      try {
        await this.deductWalletForSession(saved);
      } catch (err) {
        this.logger.warn(`NO_SHOW deduct failed for session ${saved._id}: ${(err as Error).message}`);
      }
    }

    return saved;
  }

  // ──────────────────────────────────────────────────────────────────
  //  DELETE (soft-delete chỉ OPS/DIRECTOR, chỉ khi SCHEDULED)
  // ──────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const session = await this.sessionModel.findById(id);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chỉ xóa được buổi ở trạng thái SCHEDULED',
      );
    }

    await this.sessionModel.findByIdAndDelete(id);
  }

  // ──────────────────────────────────────────────────────────────────
  //  STATS (thống kê nhanh)
  // ──────────────────────────────────────────────────────────────────

  async getStats(filter: { teacherId?: string; classId?: string; fromDate?: string; toDate?: string }) {
    const match: FilterQuery<Session> = {};
    if (filter.teacherId) match.teacherId = new Types.ObjectId(filter.teacherId);
    if (filter.classId) match.classId = new Types.ObjectId(filter.classId);
    if (filter.fromDate || filter.toDate) {
      match.scheduledDate = {};
      if (filter.fromDate) match.scheduledDate.$gte = new Date(filter.fromDate);
      if (filter.toDate) match.scheduledDate.$lte = new Date(filter.toDate);
    }

    const result = await this.sessionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCharged: { $sum: '$amountCharged' },
          totalPayout: { $sum: '$teacherPayout' },
        },
      },
    ]);

    // Flatten into a summary object
    const summary: Record<string, { count: number; totalCharged: number; totalPayout: number }> = {};
    for (const r of result) {
      summary[r._id] = {
        count: r.count,
        totalCharged: r.totalCharged,
        totalPayout: r.totalPayout,
      };
    }

    const totalSessions = result.reduce((acc, r) => acc + r.count, 0);
    const totalRevenue = result.reduce((acc, r) => acc + r.totalCharged, 0);
    const totalTeacherCost = result.reduce((acc, r) => acc + r.totalPayout, 0);

    return { totalSessions, totalRevenue, totalTeacherCost, byStatus: summary };
  }

  // ──────────────────────────────────────────────────────────────────
  //  CRON: AUTO-CONFIRM
  //  Chạy mỗi giờ, tìm sessions TEACHER_COMPLETED quá X giờ → FINALIZED
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async autoConfirmSessions() {
    const now = new Date();

    // Find sessions in TEACHER_COMPLETED with teacherCompletedAt + autoConfirmAfterHours < now
    const sessions = await this.sessionModel.find({
      status: SessionStatus.TEACHER_COMPLETED,
      'confirmation.teacherCompletedAt': { $exists: true },
    });

    let confirmed = 0;
    for (const session of sessions) {
      if (!session.confirmation?.teacherCompletedAt) continue;

      const deadline = new Date(session.confirmation.teacherCompletedAt);
      deadline.setHours(deadline.getHours() + session.autoConfirmAfterHours);

      if (now >= deadline) {
        // Atomic transition to prevent race with parentConfirm
        const updated = await this.sessionModel.findOneAndUpdate(
          { _id: session._id, status: SessionStatus.TEACHER_COMPLETED },
          {
            $set: {
              status: SessionStatus.FINALIZED,
              'confirmation.autoConfirmedAt': now,
              'confirmation.finalizedAt': now,
            },
          },
          { new: true },
        );
        if (!updated) continue; // Already finalized by parent

        // Trừ ví PH
        await this.deductWalletForSession(updated);

        confirmed++;
      }
    }

    if (confirmed > 0) {
      this.logger.log(`Auto-confirmed ${confirmed} sessions`);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Recovery: FINALIZED but isPaid = false → retry wallet deduction
  // ──────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_2_HOURS)
  async retryUnpaidFinalizedSessions() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 1); // Only retry sessions finalized > 1h ago

    const sessions = await this.sessionModel.find({
      status: SessionStatus.FINALIZED,
      isPaid: false,
      amountCharged: { $gt: 0 },
      parentUserId: { $exists: true },
      'confirmation.finalizedAt': { $lt: cutoff },
    }).limit(50); // Process in batches

    let recovered = 0;
    for (const session of sessions) {
      // Skip unconverted trials
      if (session.sessionType === 'TRIAL' && !session.trialConverted) continue;

      await this.deductWalletForSession(session);
      if (session.isPaid) recovered++;
    }

    if (recovered > 0) {
      this.logger.log(`Recovery: retried wallet deduction for ${recovered} sessions`);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────────────────────────────

  /**
   * Tính số giờ còn lại trước buổi học
   */
  private calcHoursBefore(scheduledDate: Date, scheduledStartTime?: string): number {
    const sessionStart = new Date(scheduledDate);
    if (scheduledStartTime) {
      const [h, m] = scheduledStartTime.split(':').map(Number);
      sessionStart.setHours(h, m, 0, 0);
    } else {
      // Nếu không có giờ cụ thể, dùng đầu ngày
      sessionStart.setHours(0, 0, 0, 0);
    }

    const now = new Date();
    const diffMs = sessionStart.getTime() - now.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Trừ ví PH khi session FINALIZED.
   * - Trial sessions: chỉ trừ ví nếu trialConverted = true
   * - Trial không convert: không trừ ví, nhưng GV vẫn được trả lương
   */
  private async deductWalletForSession(session: SessionDocument): Promise<void> {
    if (!session.parentUserId || session.isPaid || session.amountCharged <= 0) return;

    // ── Trial session logic ──
    // Trial chưa convert → không trừ ví PH (GV vẫn được trả qua payroll)
    if (
      session.sessionType === 'TRIAL' &&
      !session.trialConverted
    ) {
      this.logger.log(
        `Session ${session._id} is TRIAL (not converted) — skipping wallet deduction, teacher will still be paid`,
      );
      return;
    }

    // Atomic check-and-set isPaid to prevent double deduction (race condition)
    const updated = await this.sessionModel.findOneAndUpdate(
      { _id: session._id, isPaid: false },
      { $set: { isPaid: true } },
      { new: true },
    );

    if (!updated) {
      this.logger.log(`Session ${session._id} already paid, skipping deduction`);
      return;
    }

    try {
      // Load giá buổi để tính debt limit
      const classroom = await this.classModel.findById(session.classId).select('pricePerSession').lean();

      await this.walletsService.deductForSession({
        parentUserId: session.parentUserId.toString(),
        sessionId: (session._id as Types.ObjectId).toString(),
        classId: session.classId.toString(),
        studentId: session.studentId.toString(),
        amount: session.amountCharged,
        pricePerSession: classroom?.pricePerSession,
      });
    } catch (err) {
      // Rollback isPaid if deduction fails
      await this.sessionModel.updateOne(
        { _id: session._id },
        { $set: { isPaid: false } },
      );
      this.logger.warn(
        `Wallet deduct failed for session ${session._id}: ${(err as Error).message}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  TRIAL SESSION: Convert buổi thử thành buổi trả phí
  // ──────────────────────────────────────────────────────────────────

  /**
   * Khi HS quyết định học tiếp sau buổi thử:
   * - Mark trialConverted = true
   * - Trigger trừ ví PH cho tất cả buổi TRIAL đã FINALIZED
   */
  async convertTrialSessions(
    studentId: string,
    classId: string,
  ): Promise<{ converted: number; deducted: number }> {
    const trialSessions = await this.sessionModel.find({
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      sessionType: 'TRIAL',
      trialConverted: false,
      status: 'FINALIZED',
    });

    let converted = 0;
    let deducted = 0;

    for (const session of trialSessions) {
      session.trialConverted = true;
      await session.save();
      converted++;

      // Now deduct wallet
      await this.deductWalletForSession(session);
      // Reload to get updated isPaid from atomic deductWalletForSession
      const reloaded = await this.sessionModel.findById(session._id).lean();
      if (reloaded?.isPaid) deducted++;
    }

    this.logger.log(
      `Trial conversion: student ${studentId} class ${classId} → ${converted} sessions converted, ${deducted} wallet deductions`,
    );

    return { converted, deducted };
  }

  /**
   * Khi HS KHÔNG học tiếp sau buổi thử:
   * - Mark trialTeacherPaidOnly = true (GV vẫn được trả lương)
   * - Không trừ ví PH
   */
  async markTrialTeacherPaidOnly(
    studentId: string,
    classId: string,
  ): Promise<{ updated: number }> {
    const result = await this.sessionModel.updateMany(
      {
        studentId: new Types.ObjectId(studentId),
        classId: new Types.ObjectId(classId),
        sessionType: 'TRIAL',
        trialConverted: false,
        trialTeacherPaidOnly: false,
      },
      { $set: { trialTeacherPaidOnly: true } },
    );

    this.logger.log(
      `Trial teacher-paid-only: student ${studentId} class ${classId} → ${result.modifiedCount} sessions`,
    );

    return { updated: result.modifiedCount };
  }

  // ──────────────────────────────────────────────────────────────────
  //  PARENT: Children Progress (P1)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Aggregate tiến độ học tập của tất cả con theo parentUserId.
   * Trả về: evaluation scores, homework pending, curriculum progress, teacher comments.
   */
  async getChildrenProgress(parentUserId: string) {
    const parentObjId = new Types.ObjectId(parentUserId);

    // Tìm tất cả học sinh của phụ huynh
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName studentCode grade subjects')
      .lean();

    if (!children.length) return { children: [] };

    const childIds = children.map((c) => c._id);

    // Lấy tất cả sessions có evaluation hoặc teachingReport
    const sessions = await this.sessionModel
      .find({
        studentId: { $in: childIds },
        status: { $in: ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'] },
      })
      .select(
        'studentId classId evaluation teachingReport hasTeachingReport scheduledDate status',
      )
      .populate('classId', 'name code curriculum')
      .sort({ scheduledDate: -1 })
      .lean();

    // Group sessions by student
    const sessionsByStudent = new Map<string, any[]>();
    for (const s of sessions) {
      const sid = s.studentId.toString();
      if (!sessionsByStudent.has(sid)) sessionsByStudent.set(sid, []);
      sessionsByStudent.get(sid)!.push(s);
    }

    const result = children.map((child) => {
      const studentSessions = sessionsByStudent.get(child._id.toString()) || [];

      // Tính trung bình evaluation scores
      const withEval = studentSessions.filter(
        (s) => s.evaluation?.studentPerformance,
      );
      const avgPerformance =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.studentPerformance || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;
      const avgEngagement =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.studentEngagement || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;
      const avgComprehension =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.comprehensionLevel || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;

      // Homework pending (assigned nhưng chưa graded)
      const homeworkList = studentSessions
        .filter(
          (s) =>
            s.evaluation?.homeworkAssigned &&
            s.evaluation.homeworkStatus !== 'GRADED',
        )
        .map((s) => ({
          sessionDate: s.scheduledDate,
          className: (s.classId as any)?.name || '',
          homework: s.evaluation.homeworkAssigned,
          deadline: s.evaluation.homeworkDeadline,
          status: s.evaluation.homeworkStatus || 'ASSIGNED',
          score: s.evaluation.homeworkScore,
        }));

      // Recent teacher comments
      const recentComments = studentSessions
        .filter((s) => s.teachingReport?.teacherComment || s.evaluation?.overallComment)
        .slice(0, 10)
        .map((s) => ({
          sessionDate: s.scheduledDate,
          className: (s.classId as any)?.name || '',
          teacherComment: s.teachingReport?.teacherComment || '',
          overallComment: s.evaluation?.overallComment || '',
          progressPercent: s.evaluation?.progressPercent,
        }));

      // Curriculum progress per class
      const classMap = new Map<string, any>();
      for (const s of studentSessions) {
        const cid = (s.classId as any)?._id?.toString();
        if (!cid) continue;
        if (!classMap.has(cid)) {
          const curriculum = (s.classId as any)?.curriculum || [];
          const completed = curriculum.filter((c: any) => c.isCompleted).length;
          classMap.set(cid, {
            classId: cid,
            className: (s.classId as any)?.name || '',
            classCode: (s.classId as any)?.code || '',
            totalItems: curriculum.length,
            completedItems: completed,
            progressPercent:
              curriculum.length > 0
                ? Math.round((completed / curriculum.length) * 100)
                : 0,
          });
        }
      }

      return {
        student: {
          _id: child._id,
          fullName: child.fullName,
          studentCode: child.studentCode,
          grade: child.grade,
          subjects: child.subjects,
        },
        totalSessions: studentSessions.length,
        evaluation: {
          avgPerformance,
          avgEngagement,
          avgComprehension,
          totalEvaluated: withEval.length,
        },
        homework: {
          pending: homeworkList.filter((h) => h.status !== 'GRADED').length,
          list: homeworkList,
        },
        recentComments,
        curriculumProgress: Array.from(classMap.values()),
      };
    });

    return { children: result };
  }

  // ──────────────────────────────────────────────────────────────────
  //  SCHEDULE CONFLICT DETECTION (O1)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Check xung đột lịch cho teacher và student.
   * 2 sessions xung đột nếu cùng ngày VÀ thời gian overlap.
   */
  async checkConflicts(params: {
    teacherId?: string;
    studentId?: string;
    scheduledDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    excludeSessionId?: string;
  }): Promise<{ hasConflict: boolean; conflicts: any[] }> {
    const date = new Date(params.scheduledDate);
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const conflicts: any[] = [];

    const baseFilter: any = {
      scheduledDate: { $gte: dayStart, $lt: dayEnd },
      status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
      scheduledStartTime: { $exists: true },
      scheduledEndTime: { $exists: true },
    };
    if (params.excludeSessionId) {
      baseFilter._id = { $ne: new Types.ObjectId(params.excludeSessionId) };
    }

    // Check teacher conflicts
    if (params.teacherId) {
      const teacherSessions = await this.sessionModel
        .find({ ...baseFilter, teacherId: new Types.ObjectId(params.teacherId) })
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean();

      for (const s of teacherSessions) {
        if (
          this.isTimeOverlap(
            params.scheduledStartTime,
            params.scheduledEndTime,
            s.scheduledStartTime!,
            s.scheduledEndTime!,
          )
        ) {
          conflicts.push({
            type: 'TEACHER',
            session: s,
            message: `Giáo viên đã có buổi học ${s.scheduledStartTime}-${s.scheduledEndTime} với ${(s.studentId as any)?.fullName || 'HS'} lớp ${(s.classId as any)?.name || ''}`,
          });
        }
      }
    }

    // Check student conflicts
    if (params.studentId) {
      const studentSessions = await this.sessionModel
        .find({ ...baseFilter, studentId: new Types.ObjectId(params.studentId) })
        .populate('teacherId', 'fullName')
        .populate('classId', 'name code')
        .lean();

      for (const s of studentSessions) {
        if (
          this.isTimeOverlap(
            params.scheduledStartTime,
            params.scheduledEndTime,
            s.scheduledStartTime!,
            s.scheduledEndTime!,
          )
        ) {
          conflicts.push({
            type: 'STUDENT',
            session: s,
            message: `Học sinh đã có buổi học ${s.scheduledStartTime}-${s.scheduledEndTime} với GV ${(s.teacherId as any)?.fullName || ''} lớp ${(s.classId as any)?.name || ''}`,
          });
        }
      }
    }

    return { hasConflict: conflicts.length > 0, conflicts };
  }

  /**
   * Kiểm tra 2 khoảng thời gian có overlap không.
   * Format: "HH:mm"
   */
  private isTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);
    return s1 < e2 && s2 < e1;
  }

  /**
   * Đếm sessions FINALIZED cho 1 GV trong khoảng thời gian (dùng cho payroll)
   */
  async countFinalizedForPayroll(
    teacherId: string,
    from: Date,
    to: Date,
    mongoSession?: any,
  ): Promise<{ count: number; totalPayout: number; sessions: SessionDocument[] }> {
    let query = this.sessionModel.find({
      teacherId: new Types.ObjectId(teacherId),
      status: SessionStatus.FINALIZED,
      'confirmation.finalizedAt': { $gte: from, $lte: to },
      isTeacherPaid: false,
      hasTeachingReport: true, // Chỉ tính lương buổi có báo cáo giảng dạy
    });
    if (mongoSession) query = query.session(mongoSession);
    const sessions = await query;

    const totalPayout = sessions.reduce((acc, s) => acc + s.teacherPayout, 0);
    return { count: sessions.length, totalPayout, sessions };
  }

  /**
   * Đánh dấu sessions đã tính lương (sau khi payroll approved)
   */
  async markTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    await this.sessionModel.updateMany(
      { _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { isTeacherPaid: true } },
      mongoSession ? { session: mongoSession } : undefined,
    );
  }

  /**
   * Check which sessions are already claimed (isTeacherPaid = true)
   */
  async checkTeacherPaid(sessionIds: string[]): Promise<string[]> {
    const claimed = await this.sessionModel
      .find({
        _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) },
        isTeacherPaid: true,
      })
      .select('_id')
      .lean();
    return claimed.map((s) => s._id.toString());
  }

  /**
   * Giải phóng sessions khi payroll bị reject hoặc xóa
   */
  async unmarkTeacherPaid(sessionIds: string[], mongoSession?: any): Promise<void> {
    await this.sessionModel.updateMany(
      { _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { isTeacherPaid: false } },
      mongoSession ? { session: mongoSession } : undefined,
    );
  }

  /**
   * Đánh dấu sessions đã trừ ví PH
   */
  async markPaid(sessionIds: string[]): Promise<void> {
    await this.sessionModel.updateMany(
      { _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { isPaid: true } },
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // PARENT FEEDBACK (Phase 3.2)
  // ════════════════════════════════════════════════════════════════════

  async submitParentFeedback(parentUserId: string, feedback: {
    overallRating: number;
    teachingQuality?: number;
    communication?: number;
    facility?: number;
    comment?: string;
    studentId?: string;
  }) {
    const parentObjId = new Types.ObjectId(parentUserId);

    // Find recent finalized sessions for this parent's children
    const filter: any = {
      parentUserId: parentObjId,
      status: 'FINALIZED',
    };
    if (feedback.studentId) {
      filter.studentId = new Types.ObjectId(feedback.studentId);
    }

    // Store feedback on the most recent session
    const session = await this.sessionModel
      .findOne(filter)
      .sort({ scheduledDate: -1 });

    if (!session) {
      return { success: true, message: 'Feedback đã được ghi nhận (không có session liên quan)' };
    }

    // Store in evaluation.parentFeedback
    await this.sessionModel.updateOne(
      { _id: session._id },
      {
        $set: {
          'evaluation.parentFeedback': {
            overallRating: feedback.overallRating,
            teachingQuality: feedback.teachingQuality,
            communication: feedback.communication,
            facility: feedback.facility,
            comment: feedback.comment,
            submittedAt: new Date(),
          },
        },
      },
    );

    return { success: true, message: 'Cảm ơn bạn đã gửi đánh giá!' };
  }
}
