import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  Ticket,
  TicketDocument,
  TicketStatus,
  TicketPriority,
  TicketType,
  TicketComment,
  TicketCommentDocument,
} from './schemas/ticket.schema';

import { WalletsService } from '../wallets/wallets.service';
import { ClassesService } from '../classes/classes.service';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(TicketComment.name) private commentModel: Model<TicketCommentDocument>,
    private readonly walletsService: WalletsService,
    private readonly classesService: ClassesService,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  CREATE
  // ══════════════════════════════════════════════════════════════════

  async create(dto: CreateTicketDto, userId: string, userRole: string): Promise<TicketDocument> {
    // Auto-gen ticket code with collision retry: TKT-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    let ticketCode = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidate = `TKT-${dateStr}-${rand}`;
      const exists = await this.ticketModel.exists({ ticketCode: candidate });
      if (!exists) { ticketCode = candidate; break; }
    }
    if (!ticketCode) {
      // Fallback: use timestamp-based code
      ticketCode = `TKT-${dateStr}-${Date.now().toString(36).toUpperCase()}`;
    }

    // SLA: set due date based on priority
    const dueDate = new Date(now);
    switch (dto.priority || TicketPriority.MEDIUM) {
      case TicketPriority.URGENT:
        dueDate.setHours(dueDate.getHours() + 4);
        break;
      case TicketPriority.HIGH:
        dueDate.setHours(dueDate.getHours() + 24);
        break;
      case TicketPriority.MEDIUM:
        dueDate.setHours(dueDate.getHours() + 48);
        break;
      case TicketPriority.LOW:
        dueDate.setHours(dueDate.getHours() + 72);
        break;
    }

    const ticket = await this.ticketModel.create({
      ticketCode,
      type: dto.type,
      subject: dto.subject,
      description: dto.description,
      priority: dto.priority || TicketPriority.MEDIUM,
      createdBy: new Types.ObjectId(userId),
      createdByRole: userRole,
      sessionId: dto.sessionId ? new Types.ObjectId(dto.sessionId) : undefined,
      classId: dto.classId ? new Types.ObjectId(dto.classId) : undefined,
      studentId: dto.studentId ? new Types.ObjectId(dto.studentId) : undefined,
      teacherId: dto.teacherId ? new Types.ObjectId(dto.teacherId) : undefined,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : undefined,
      payrollId: dto.payrollId ? new Types.ObjectId(dto.payrollId) : undefined,
      ledgerEntryId: dto.ledgerEntryId ? new Types.ObjectId(dto.ledgerEntryId) : undefined,
      substituteTeacherId: dto.substituteTeacherId ? new Types.ObjectId(dto.substituteTeacherId) : undefined,
      substituteFromDate: dto.substituteFromDate ? new Date(dto.substituteFromDate) : undefined,
      substituteToDate: dto.substituteToDate ? new Date(dto.substituteToDate) : undefined,
      attachments: dto.attachments || [],
      dueDate,
    });

    this.logger.log(`Ticket created: ${ticketCode} | type: ${dto.type} | priority: ${dto.priority || 'MEDIUM'}`);
    return ticket;
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUERY
  // ══════════════════════════════════════════════════════════════════

  /** Find tickets where user is creator OR a referenced party (teacherId/parentId) */
  async findMyTickets(userId: string, query: QueryTicketDto) {
    const userOid = new Types.ObjectId(userId);
    const orConditions: FilterQuery<Ticket>[] = [
      { createdBy: userOid },
      { teacherId: userOid },
      { parentId: userOid },
    ];

    const filter: FilterQuery<Ticket> = { $or: orConditions };
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-createdAt';

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'fullName email role')
        .populate('assignedTo', 'fullName email')
        .populate('sessionId', 'scheduledDate scheduledStartTime status')
        .populate('classId', 'name code')
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(query: QueryTicketDto) {
    const filter: FilterQuery<Ticket> = {};

    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.createdBy) filter.createdBy = new Types.ObjectId(query.createdBy);
    if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);
    if (query.sessionId) filter.sessionId = new Types.ObjectId(query.sessionId);

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-createdAt';

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'fullName email role')
        .populate('assignedTo', 'fullName email')
        .populate('sessionId', 'scheduledDate scheduledStartTime status')
        .populate('classId', 'name code')
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, actor?: JwtPayload): Promise<TicketDocument> {
    const ticket = await this.ticketModel
      .findById(id)
      .populate('createdBy', 'fullName email phone role')
      .populate('assignedTo', 'fullName email')
      .populate('sessionId', 'scheduledDate scheduledStartTime scheduledEndTime status amountCharged')
      .populate('classId', 'name code')
      .populate('studentId', 'fullName studentCode')
      .populate('teacherId', 'fullName email')
      .populate('parentId', 'fullName email')
      .populate('resolution.resolvedBy', 'fullName');

    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    // PARENT/TEACHER can only view tickets they created or are a referenced party on
    if (actor && [Role.PARENT, Role.TEACHER].includes(actor.role)) {
      const ticketObj = ticket.toObject() as any;
      const userId = actor.sub;
      const isOwner = ticketObj.createdBy?._id?.toString() === userId;
      const isParty =
        ticketObj.teacherId?._id?.toString() === userId ||
        ticketObj.parentId?._id?.toString() === userId;
      if (!isOwner && !isParty) {
        throw new NotFoundException('Ticket không tồn tại');
      }
    }

    return ticket;
  }

  // ══════════════════════════════════════════════════════════════════
  //  UPDATE (priority, assign)
  // ══════════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateTicketDto): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)) {
      throw new BadRequestException('Không thể sửa ticket đã đóng/hủy');
    }

    if (dto.priority) ticket.priority = dto.priority;
    if (dto.assignedTo) {
      ticket.assignedTo = new Types.ObjectId(dto.assignedTo);
      ticket.assignedAt = new Date();
      if (ticket.status === TicketStatus.OPEN) {
        ticket.status = TicketStatus.IN_PROGRESS;
      }
    }

    return ticket.save();
  }

  // ══════════════════════════════════════════════════════════════════
  //  COMMENTS
  // ══════════════════════════════════════════════════════════════════

  async addComment(ticketId: string, userId: string, dto: AddCommentDto, actor?: JwtPayload): Promise<any> {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    // PARENT/TEACHER can only comment on their own tickets
    if (actor && [Role.PARENT, Role.TEACHER].includes(actor.role)) {
      const isOwner = ticket.createdBy?.toString() === actor.sub;
      const isParty =
        (ticket as any).teacherId?.toString() === actor.sub ||
        (ticket as any).parentId?.toString() === actor.sub;
      if (!isOwner && !isParty) {
        throw new NotFoundException('Ticket không tồn tại');
      }
    }

    if ([TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)) {
      throw new BadRequestException('Không thể comment vào ticket đã đóng');
    }

    // PARENT/TEACHER cannot create internal notes
    const isStaff = actor && [Role.OPS, Role.DIRECTOR].includes(actor.role);
    const isInternal = isStaff ? (dto.isInternal || false) : false;

    const comment = await this.commentModel.create({
      ticketId: ticket._id,
      userId: new Types.ObjectId(userId),
      content: dto.content,
      attachments: dto.attachments || [],
      isInternal,
    });

    // Auto-transition: if ticket is WAITING_INFO and the commenter is the ticket creator (PH/GV),
    // move back to IN_PROGRESS so OPS knows info has been provided
    if (ticket.status === TicketStatus.WAITING_INFO && !isInternal) {
      const isTicketCreator = ticket.createdBy?.toString() === userId;
      if (isTicketCreator) {
        ticket.status = TicketStatus.IN_PROGRESS;
        await ticket.save();
      }
    }

    return comment;
  }

  async getComments(ticketId: string, includeInternal: boolean, actor?: JwtPayload) {
    // PARENT/TEACHER ownership check
    if (actor && [Role.PARENT, Role.TEACHER].includes(actor.role)) {
      const ticket = await this.ticketModel.findById(ticketId).lean() as any;
      if (!ticket) throw new NotFoundException('Ticket không tồn tại');
      const isOwner = ticket.createdBy?.toString() === actor.sub;
      const isParty =
        ticket.teacherId?.toString() === actor.sub ||
        ticket.parentId?.toString() === actor.sub;
      if (!isOwner && !isParty) {
        throw new NotFoundException('Ticket không tồn tại');
      }
    }

    const filter: FilterQuery<TicketComment> = { ticketId: new Types.ObjectId(ticketId) };
    if (!includeInternal) {
      filter.isInternal = false;
    }

    return this.commentModel
      .find(filter)
      .sort('createdAt')
      .populate('userId', 'fullName email role')
      .lean();
  }

  // ══════════════════════════════════════════════════════════════════
  //  WORKFLOW
  // ══════════════════════════════════════════════════════════════════

  /** OPS nhận xử lý */
  async startProcessing(id: string, opsUserId: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    if (![TicketStatus.OPEN, TicketStatus.WAITING_INFO].includes(ticket.status)) {
      throw new BadRequestException('Chỉ nhận xử lý ticket OPEN hoặc WAITING_INFO');
    }

    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.assignedTo = new Types.ObjectId(opsUserId);
    ticket.assignedAt = new Date();
    return ticket.save();
  }

  /** Yêu cầu thêm thông tin */
  async requestInfo(id: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    if (![TicketStatus.OPEN, TicketStatus.IN_PROGRESS].includes(ticket.status)) {
      throw new BadRequestException('Chỉ yêu cầu thêm thông tin được khi ticket đang OPEN hoặc IN_PROGRESS');
    }

    ticket.status = TicketStatus.WAITING_INFO;
    return ticket.save();
  }

  /** Giải quyết ticket + hoàn tiền (nếu có) */
  async resolve(id: string, userId: string, dto: ResolveTicketDto): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)) {
      throw new BadRequestException('Ticket đã được xử lý');
    }

    ticket.status = TicketStatus.RESOLVED;
    ticket.resolution = {
      summary: dto.summary,
      outcome: dto.outcome,
      refundAmount: dto.refundAmount || 0,
      resolvedBy: new Types.ObjectId(userId),
      resolvedAt: new Date(),
    };

    await ticket.save();

    // ── Auto-process SUBSTITUTE_TEACHER ticket ──
    if (
      ticket.type === TicketType.SUBSTITUTE_TEACHER &&
      dto.outcome === 'APPROVED' &&
      ticket.classId &&
      ticket.substituteTeacherId
    ) {
      try {
        const fromDate = ticket.substituteFromDate || new Date();
        const toDate = ticket.substituteToDate || ticket.substituteFromDate || new Date();
        const payRate = dto.substitutePayRate ?? (ticket as any).substitutePayRate ?? 0;
        const canCreateLink = dto.substituteCanCreateLink ?? (ticket as any).substituteCanCreateLink ?? true;

        // Update ticket with resolved pay rate
        ticket.substitutePayRate = payRate;
        ticket.substituteCanCreateLink = canCreateLink;
        await ticket.save();

        await this.classesService.addSubstituteTeacher(
          ticket.classId.toString(),
          {
            teacherId: ticket.substituteTeacherId.toString(),
            fromDate,
            toDate,
            payRate,
            canCreateLink,
            ticketId: ticket._id?.toString(),
            approvedBy: userId,
          },
        );
        this.logger.log(
          `Ticket ${ticket.ticketCode}: Added substitute teacher ${ticket.substituteTeacherId} to class ${ticket.classId} (${fromDate.toISOString().slice(0,10)} → ${toDate.toISOString().slice(0,10)}, pay: ${payRate})`,
        );
      } catch (err) {
        this.logger.warn(
          `Ticket ${ticket.ticketCode}: Failed to add substitute teacher: ${(err as Error).message}`,
        );
      }
    }

    // Auto-refund nếu outcome = APPROVED và có refundAmount
    if (dto.outcome === 'APPROVED' && dto.refundAmount && dto.refundAmount > 0) {
      // Luôn hoàn tiền cho parent, không phải người tạo ticket
      const parentUserId = ticket.parentId?.toString();
      if (!parentUserId) {
        this.logger.warn(`Ticket ${ticket.ticketCode} refund skipped: no parentId`);
      } else {
        try {
          await this.walletsService.refundForSession({
            parentUserId,
            sessionId: ticket.sessionId?.toString() || '',
            classId: ticket.classId?.toString() || '',
            studentId: ticket.studentId?.toString() || '',
            refundAmount: dto.refundAmount,
          });
          this.logger.log(`Ticket ${ticket.ticketCode} resolved with refund: ${dto.refundAmount}đ`);
        } catch (err) {
          this.logger.warn(`Refund failed for ticket ${ticket.ticketCode}: ${(err as Error).message}`);
        }
      }
    }

    // Return fresh data with populated refs
    return this.ticketModel
      .findById(id)
      .populate('createdBy', 'fullName email phone role')
      .populate('assignedTo', 'fullName email')
      .populate('sessionId', 'scheduledDate scheduledStartTime scheduledEndTime status amountCharged')
      .populate('classId', 'name code')
      .populate('studentId', 'fullName studentCode')
      .populate('teacherId', 'fullName email')
      .populate('parentId', 'fullName email')
      .populate('resolution.resolvedBy', 'fullName') as Promise<TicketDocument>;
  }

  /** Đóng ticket (chỉ sau khi resolved) */
  async close(id: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    if (ticket.status !== TicketStatus.RESOLVED) {
      throw new BadRequestException('Chỉ đóng được ticket đã RESOLVED');
    }

    ticket.status = TicketStatus.CLOSED;
    return ticket.save();
  }

  /** Người tạo hủy ticket */
  async cancel(id: string, userId: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    if (ticket.createdBy.toString() !== userId) {
      throw new BadRequestException('Chỉ người tạo mới hủy được ticket');
    }

    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status)) {
      throw new BadRequestException('Không thể hủy ticket đã xử lý');
    }

    ticket.status = TicketStatus.CANCELLED;
    return ticket.save();
  }

  /** Mở lại ticket đã resolve */
  async reopen(id: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED) {
      throw new BadRequestException('Chỉ mở lại ticket RESOLVED hoặc CLOSED');
    }

    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.resolution = undefined;
    return ticket.save();
  }

  // ══════════════════════════════════════════════════════════════════
  //  STATS
  // ══════════════════════════════════════════════════════════════════

  async getStats() {
    const [byStatus, byType, byPriority, overdue] = await Promise.all([
      this.ticketModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $match: { status: { $nin: [TicketStatus.CLOSED, TicketStatus.CANCELLED] } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $match: { status: { $nin: [TicketStatus.CLOSED, TicketStatus.CANCELLED] } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      this.ticketModel.countDocuments({
        status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] },
        dueDate: { $lt: new Date() },
      }),
    ]);

    return { byStatus, byType, byPriority, overdueCount: overdue };
  }

  // ══════════════════════════════════════════════════════════════════
  //  SLA CHECK (có thể gọi bởi cron)
  // ══════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_HOUR)
  async markOverdueTickets(): Promise<number> {
    const result = await this.ticketModel.updateMany(
      {
        status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] },
        dueDate: { $lt: new Date() },
        isOverdue: false,
      },
      { $set: { isOverdue: true } },
    );
    if (result.modifiedCount > 0) {
      this.logger.warn(`Marked ${result.modifiedCount} tickets as overdue`);
    }
    return result.modifiedCount;
  }
}
