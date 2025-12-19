import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/interfaces/role.enum';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { InvoiceSequence, InvoiceSequenceDocument } from './schemas/invoice-sequence.schema';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(InvoiceSequence.name) private readonly invoiceSeqModel: Model<InvoiceSequenceDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  async create(dto: CreateInvoiceDto, actor: UserDocument) {
    const invoiceNumber = await this.generateInvoiceNumber(actor);

    const entity = new this.invoiceModel({ 
      ...dto, 
      invoiceNumber,
      saleCode: this.extractSaleCode(actor.email),
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
    // Không cho chỉnh sửa mã hóa đơn hoặc mã sale
    const { invoiceNumber, saleCode, ...safeDto } = dto as any;

    const updated = await this.invoiceModel.findByIdAndUpdate(id, safeDto, { new: true })
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
            transferDate: payment.transferDate || null,
            cod: payment.cod || '',
            saleName: (student as any).saleName || '',
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

  async updatePaymentFrame(studentId: string, frameIndex: number, payload: { cod?: string; transferDate?: string }) {
    const student = await this.studentModel.findById(studentId);
    if (!student) {
      throw new NotFoundException('Học sinh không tồn tại');
    }

    const payment = student.payments?.find(p => p.frameIndex === frameIndex);
    if (!payment) {
      throw new NotFoundException('Không tìm thấy thông tin thanh toán');
    }

    if (payload.cod !== undefined) payment.cod = payload.cod;
    if (payload.transferDate !== undefined) payment.transferDate = payload.transferDate ? new Date(payload.transferDate) : undefined;

    await student.save();

    return { success: true };
  }

  private extractSaleCode(email?: string): string {
    if (!email) return 'SALE';
    const prefix = email.split('@')[0] || 'SALE';
    const cleaned = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned || 'SALE';
  }

  private async generateInvoiceNumber(actor: UserDocument): Promise<string> {
    const saleCode = this.extractSaleCode(actor.email);
    const seq = await this.invoiceSeqModel.findOneAndUpdate(
      { saleCode },
      { $inc: { current: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const padded = String(seq.current).padStart(4, '0');
    return `${saleCode}-${padded}`;
  }
}