import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payroll, PayrollDocument, PayrollStatus } from '../payroll/schemas/payroll.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { LedgerEntry, LedgerEntryDocument, TransactionStatus, TransactionType } from '../wallets/schemas/ledger-entry.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Ticket, TicketDocument } from '../tickets/schemas/ticket.schema';

@Injectable()
export class PendingApprovalsService {
  constructor(
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(TeacherProfile.name) private teacherModel: Model<any>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
  ) {}

  async getSummary() {
    const [
      pendingPayrolls,
      pendingInvoices,
      pendingTopUps,
      pendingTeachers,
      openTickets,
    ] = await Promise.all([
      this.payrollModel.countDocuments({ status: PayrollStatus.PENDING_REVIEW }),
      this.invoiceModel.countDocuments({ status: { $in: ['PENDING', 'PENDING_APPROVAL'] } }),
      this.ledgerModel.countDocuments({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING }),
      this.teacherModel.countDocuments({ status: 'PENDING' }),
      this.ticketModel.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    ]);

    return {
      pendingPayrolls,
      pendingInvoices,
      pendingTopUps,
      pendingTeachers,
      openTickets,
      totalPending: pendingPayrolls + pendingInvoices + pendingTopUps + pendingTeachers,
    };
  }

  async getPendingPayrolls() {
    return this.payrollModel
      .find({ status: PayrollStatus.PENDING_REVIEW })
      .populate('teacherId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPendingInvoices() {
    return this.invoiceModel
      .find({ status: { $in: ['PENDING', 'PENDING_APPROVAL'] } })
      .populate('studentId', 'fullName')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPendingTopUps() {
    return this.ledgerModel
      .find({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING })
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPendingTeachers() {
    return this.teacherModel
      .find({ status: 'PENDING' })
      .populate('userId', 'fullName email phone')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getAll() {
    const [summary, payrolls, invoices, topUps, teachers] = await Promise.all([
      this.getSummary(),
      this.getPendingPayrolls(),
      this.getPendingInvoices(),
      this.getPendingTopUps(),
      this.getPendingTeachers(),
    ]);

    return { summary, payrolls, invoices, topUps, teachers };
  }
}
