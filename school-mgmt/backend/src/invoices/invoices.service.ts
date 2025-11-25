import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/interfaces/role.enum';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
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
}