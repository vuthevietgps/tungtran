import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/interfaces/role.enum';
import { Student, StudentDocument } from '../students/schemas/student.schema';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  async create(dto: CreateInvoiceDto, actor: UserDocument) {
    // Kiểm tra số hóa đơn có trùng không
    const existingInvoice = await this.invoiceModel.findOne({ invoiceNumber: dto.invoiceNumber });
    if (existingInvoice) {
      throw new Error('Số hóa đơn đã tồn tại');
    }

    const entity = new this.invoiceModel({ 
      ...dto, 
      studentId: new Types.ObjectId(dto.studentId),
      createdBy: actor._id 
    });
    return entity.save();
  }

  async findAll(actor: UserDocument) {
    const filter = actor.role === Role.DIRECTOR ? {} : { createdBy: actor._id };
    return this.invoiceModel.find(filter)
      .populate('studentId', 'fullName parentName parentPhone')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOne(id: string) {
    const invoice = await this.invoiceModel.findById(id)
      .populate('studentId', 'fullName parentName parentPhone')
      .populate('createdBy', 'fullName email')
      .lean();
    if (!invoice) throw new NotFoundException('Hóa đơn không tồn tại');
    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    if (dto.invoiceNumber) {
      const existingInvoice = await this.invoiceModel.findOne({ 
        invoiceNumber: dto.invoiceNumber,
        _id: { $ne: id }
      });
      if (existingInvoice) {
        throw new Error('Số hóa đơn đã tồn tại');
      }
    }

    const updated = await this.invoiceModel.findByIdAndUpdate(id, dto, { new: true })
      .populate('studentId', 'fullName parentName parentPhone')
      .populate('createdBy', 'fullName email')
      .lean();
    if (!updated) throw new NotFoundException('Hóa đơn không tồn tại');
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.invoiceModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Hóa đơn không tồn tại');
    return deleted;
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

    payment.confirmStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'PENDING';
    await student.save();

    return { 
      success: true, 
      message: action === 'CONFIRM' ? 'Đã duyệt hóa đơn' : 'Đã từ chối hóa đơn' 
    };
  }
}