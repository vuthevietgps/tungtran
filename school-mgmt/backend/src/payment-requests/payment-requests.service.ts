import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaymentRequest, PaymentRequestDocument, SessionInfo } from './schemas/payment-request.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { SubmitPaymentRequestDto } from './dto/submit-payment-request.dto';

export interface PaymentRequestView {
  _id: string;
  orderId: string;
  studentCode: string;
  studentName: string;
  classCode: string;
  teacherSalary?: number;
  sessions: SessionInfo[];
  totalAttendedSessions: number;
  teacherEarnedSalary: number;
  paymentStatus?: string;
  paymentInvoiceCode?: string;
  paymentProofImage?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PaymentRequestsService {
  constructor(
    @InjectModel(PaymentRequest.name) private readonly paymentRequestModel: Model<PaymentRequestDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  async findAll(): Promise<PaymentRequestView[]> {
    const requests = await this.paymentRequestModel.find().sort({ createdAt: -1 }).lean();
    return requests.map((req) => this.toView(req));
  }

  async findOne(id: string): Promise<PaymentRequestView> {
    const request = await this.paymentRequestModel.findById(id).lean();
    if (!request) throw new NotFoundException('Không tìm thấy đề nghị thanh toán');
    return this.toView(request);
  }

  async submitRequest(id: string, dto: SubmitPaymentRequestDto): Promise<PaymentRequestView> {
    const request = await this.paymentRequestModel.findById(id);
    if (!request) throw new NotFoundException('Không tìm thấy đề nghị thanh toán');

    // Update payment request status
    request.paymentStatus = dto.paymentStatus;
    await request.save();

    // Update corresponding order payment status
    await this.orderModel.findByIdAndUpdate(request.orderId, {
      paymentStatus: dto.paymentStatus,
    });

    return this.toView(request.toObject());
  }

  async syncFromOrder(orderId: Types.ObjectId, orderData: {
    studentCode: string;
    studentName: string;
    classCode: string;
    teacherSalary?: number;
    sessions: SessionInfo[];
    totalAttendedSessions: number;
    teacherEarnedSalary: number;
    paymentStatus?: string;
    paymentInvoiceCode?: string;
    paymentProofImage?: string;
  }): Promise<void> {
    const existing = await this.paymentRequestModel.findOne({ orderId }).lean();
    
    if (existing) {
      // Update existing payment request
      await this.paymentRequestModel.findByIdAndUpdate(existing._id, {
        studentCode: orderData.studentCode,
        studentName: orderData.studentName,
        classCode: orderData.classCode,
        teacherSalary: orderData.teacherSalary,
        sessions: orderData.sessions,
        totalAttendedSessions: orderData.totalAttendedSessions,
        teacherEarnedSalary: orderData.teacherEarnedSalary,
        paymentStatus: orderData.paymentStatus,
        paymentInvoiceCode: orderData.paymentInvoiceCode,
        paymentProofImage: orderData.paymentProofImage,
      });
    } else {
      // Create new payment request
      await this.paymentRequestModel.create({
        orderId,
        studentCode: orderData.studentCode,
        studentName: orderData.studentName,
        classCode: orderData.classCode,
        teacherSalary: orderData.teacherSalary,
        sessions: orderData.sessions,
        totalAttendedSessions: orderData.totalAttendedSessions,
        teacherEarnedSalary: orderData.teacherEarnedSalary,
        paymentStatus: orderData.paymentStatus,
        paymentInvoiceCode: orderData.paymentInvoiceCode,
        paymentProofImage: orderData.paymentProofImage,
      });
    }
  }

  async deleteByOrderId(orderId: Types.ObjectId): Promise<void> {
    await this.paymentRequestModel.deleteOne({ orderId });
  }

  private toView(request: PaymentRequest & { _id: Types.ObjectId }): PaymentRequestView {
    return {
      _id: request._id.toString(),
      orderId: request.orderId.toString(),
      studentCode: request.studentCode,
      studentName: request.studentName,
      classCode: request.classCode,
      teacherSalary: request.teacherSalary,
      sessions: request.sessions || [],
      totalAttendedSessions: request.totalAttendedSessions || 0,
      teacherEarnedSalary: request.teacherEarnedSalary || 0,
      paymentStatus: request.paymentStatus,
      paymentInvoiceCode: request.paymentInvoiceCode,
      paymentProofImage: request.paymentProofImage,
      createdAt: this.toIso((request as any).createdAt),
      updatedAt: this.toIso((request as any).updatedAt),
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
