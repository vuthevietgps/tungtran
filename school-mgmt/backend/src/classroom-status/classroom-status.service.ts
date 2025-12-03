import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClassroomStatus, ClassroomStatusDocument } from './schemas/classroom-status.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { LockClassroomStatusDto } from './dto/update-classroom-status.dto';

export interface ClassroomStatusView {
  _id: string;
  orderId: string;
  studentCode: string;
  studentName: string;
  classCode: string;
  status: string;
  paymentStatus?: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ClassroomStatusService {
  constructor(
    @InjectModel(ClassroomStatus.name) private readonly classroomStatusModel: Model<ClassroomStatusDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  async findAll(): Promise<ClassroomStatusView[]> {
    const statuses = await this.classroomStatusModel.find().sort({ createdAt: -1 }).lean();
    return statuses.map((status) => this.toView(status));
  }

  async findOne(id: string): Promise<ClassroomStatusView> {
    const status = await this.classroomStatusModel.findById(id).lean();
    if (!status) throw new NotFoundException('Không tìm thấy trạng thái lớp học');
    return this.toView(status);
  }

  async lock(id: string, dto: LockClassroomStatusDto): Promise<ClassroomStatusView> {
    const status = await this.classroomStatusModel.findById(id);
    if (!status) throw new NotFoundException('Không tìm thấy trạng thái lớp học');

    // Update classroom status
    status.isLocked = dto.isLocked;
    status.status = dto.isLocked ? 'Đã khóa' : 'Đang hoạt động';
    await status.save();

    // Update corresponding order status
    await this.orderModel.findByIdAndUpdate(status.orderId, {
      status: dto.isLocked ? 'Đã khóa' : 'Đang hoạt động',
    });

    return this.toView(status.toObject());
  }

  async syncFromOrder(orderId: Types.ObjectId, orderData: {
    studentCode: string;
    studentName: string;
    classCode: string;
    status?: string;
    paymentStatus?: string;
  }): Promise<void> {
    const existing = await this.classroomStatusModel.findOne({ orderId }).lean();
    
    if (existing) {
      // Update existing status (but don't override lock status)
      await this.classroomStatusModel.findByIdAndUpdate(existing._id, {
        studentCode: orderData.studentCode,
        studentName: orderData.studentName,
        classCode: orderData.classCode,
        paymentStatus: orderData.paymentStatus,
        // Only update status if not locked
        ...((!existing.isLocked) && { status: orderData.status || 'Đang hoạt động' }),
      });
    } else {
      // Create new status
      await this.classroomStatusModel.create({
        orderId,
        studentCode: orderData.studentCode,
        studentName: orderData.studentName,
        classCode: orderData.classCode,
        status: orderData.status || 'Đang hoạt động',
        paymentStatus: orderData.paymentStatus,
        isLocked: false,
      });
    }
  }

  async deleteByOrderId(orderId: Types.ObjectId): Promise<void> {
    await this.classroomStatusModel.deleteOne({ orderId });
  }

  private toView(status: ClassroomStatus & { _id: Types.ObjectId }): ClassroomStatusView {
    return {
      _id: status._id.toString(),
      orderId: status.orderId.toString(),
      studentCode: status.studentCode,
      studentName: status.studentName,
      classCode: status.classCode,
      status: status.status || 'Đang hoạt động',
      paymentStatus: status.paymentStatus,
      isLocked: status.isLocked,
      createdAt: this.toIso((status as any).createdAt),
      updatedAt: this.toIso((status as any).updatedAt),
    };
  }

  private toIso(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (value && typeof (value as any).toDate === 'function') {
      const date: Date = (value as any).toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toISOString();
    }
    const now = new Date();
    return Number.isNaN(now.getTime()) ? new Date(Date.now()).toISOString() : now.toISOString();
  }
}
