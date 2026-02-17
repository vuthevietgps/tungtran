import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Loan, LoanDocument, LoanStatus } from './schemas/loan.schema';
import { LoanPayment, LoanPaymentDocument, LoanPaymentStatus } from './schemas/loan-payment.schema';
import { CreateLoanDto, UpdateLoanDto, RecordLoanPaymentDto, QueryLoanDto, QueryLoanPaymentDto } from './dto/loan.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { FinancialControlService } from '../financial-control/financial-control.service';

@Injectable()
export class LoansService {
  constructor(
    @InjectModel(Loan.name) private loanModel: Model<LoanDocument>,
    @InjectModel(LoanPayment.name) private paymentModel: Model<LoanPaymentDocument>,
    @InjectConnection() private connection: Connection,
    private financialControlService: FinancialControlService,
  ) {}

  // ─── Code generation ─────────────────────────────────────────────
  private async generateLoanCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.loanModel.countDocuments();
      const code = `LOAN-${String(count + 1 + attempt).padStart(3, '0')}`;
      const exists = await this.loanModel.findOne({ loanCode: code }).lean();
      if (!exists) return code;
    }
    return `LOAN-${Date.now()}`;
  }

  private async generatePaymentCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.paymentModel.countDocuments();
      const code = `LP-${String(count + 1 + attempt).padStart(5, '0')}`;
      const exists = await this.paymentModel.findOne({ paymentCode: code }).lean();
      if (!exists) return code;
    }
    return `LP-${Date.now()}`;
  }

  // ─── CRUD ────────────────────────────────────────────────────────

  async create(dto: CreateLoanDto, user: JwtPayload): Promise<Loan> {
    const loanCode = await this.generateLoanCode();

    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + dto.term);

    const loan = new this.loanModel({
      ...dto,
      loanCode,
      startDate,
      endDate,
      remainingBalance: dto.principal,
      status: LoanStatus.DRAFT,
      createdById: user._id,
      createdByName: user.fullName,
    });

    return loan.save();
  }

  async findAll(query: QueryLoanDto): Promise<Loan[]> {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.lenderType) filter.lenderType = query.lenderType;
    if (query.loanType) filter.loanType = query.loanType;
    if (query.keyword) {
      filter.$or = [
        { loanCode: new RegExp(query.keyword, 'i') },
        { lenderName: new RegExp(query.keyword, 'i') },
        { collateral: new RegExp(query.keyword, 'i') },
      ];
    }
    return this.loanModel.find(filter).sort({ createdAt: -1 }).limit(500).exec();
  }

  async findOne(id: string): Promise<LoanDocument> {
    const loan = await this.loanModel.findById(id).exec();
    if (!loan) throw new NotFoundException('Không tìm thấy khoản vay');
    return loan;
  }

  async update(id: string, dto: UpdateLoanDto): Promise<Loan> {
    const loan = await this.findOne(id);
    if (loan.status !== LoanStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa khoản vay ở trạng thái Nháp');
    }
    Object.assign(loan, dto);
    return loan.save();
  }

  // ─── Activate (DRAFT → ACTIVE) ──────────────────────────────────

  async activate(id: string, user: JwtPayload): Promise<Loan> {
    const loan = await this.findOne(id);
    if (loan.status !== LoanStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể kích hoạt khoản vay ở trạng thái Nháp');
    }

    loan.status = LoanStatus.ACTIVE;
    loan.approvedById = new Types.ObjectId(user._id);
    loan.approvedByName = user.fullName;
    loan.approvedAt = new Date();
    await loan.save();

    // Generate payment schedule
    await this.generatePaymentSchedule(loan);

    // Record bank transaction for disbursement if bankAccountId is set
    if (loan.bankAccountId) {
      await this.financialControlService.recordBankTransaction({
        bankAccountId: loan.bankAccountId.toString(),
        type: 'DEPOSIT',
        category: 'LOAN_DISBURSEMENT',
        amount: loan.principal,
        transactionDate: loan.startDate.toISOString(),
        description: `Giải ngân khoản vay ${loan.loanCode} từ ${loan.lenderName}`,
        reference: loan.loanCode,
        referenceId: (loan as any)._id.toString(),
        referenceType: 'LOAN',
      }, user);
    }

    return loan;
  }

  // ─── Payment Schedule Generation ────────────────────────────────

  private async generatePaymentSchedule(loan: LoanDocument): Promise<void> {
    const monthsPerPeriod = this.getMonthsPerPeriod(loan.paymentFrequency);
    const totalPeriods = Math.ceil(loan.term / monthsPerPeriod);
    const periodicRate = (loan.interestRate / 100) / (12 / monthsPerPeriod);

    let payments: any[] = [];
    let remainingPrincipal = loan.principal;

    if (loan.interestType === 'FIXED' && periodicRate > 0) {
      // Amortization: PMT = P * r * (1+r)^n / ((1+r)^n - 1)
      const factor = Math.pow(1 + periodicRate, totalPeriods);
      const pmt = loan.principal * periodicRate * factor / (factor - 1);

      for (let i = 1; i <= totalPeriods; i++) {
        const interestAmount = Math.round(remainingPrincipal * periodicRate);
        const principalAmount = Math.round(Math.min(pmt - interestAmount, remainingPrincipal));
        const totalAmount = principalAmount + interestAmount;

        const dueDate = new Date(loan.startDate);
        dueDate.setMonth(dueDate.getMonth() + i * monthsPerPeriod);

        const paymentCode = await this.generatePaymentCode();

        payments.push({
          paymentCode,
          loanId: (loan as any)._id,
          paymentNumber: i,
          dueDate,
          principalAmount,
          interestAmount,
          totalAmount,
          status: LoanPaymentStatus.SCHEDULED,
        });

        remainingPrincipal -= principalAmount;
      }
    } else {
      // Simple interest or zero interest: equal principal + interest on remaining
      const principalPerPeriod = Math.round(loan.principal / totalPeriods);

      for (let i = 1; i <= totalPeriods; i++) {
        const actualPrincipal = i === totalPeriods ? remainingPrincipal : principalPerPeriod;
        const interestAmount = Math.round(remainingPrincipal * periodicRate);
        const totalAmount = actualPrincipal + interestAmount;

        const dueDate = new Date(loan.startDate);
        dueDate.setMonth(dueDate.getMonth() + i * monthsPerPeriod);

        const paymentCode = await this.generatePaymentCode();

        payments.push({
          paymentCode,
          loanId: (loan as any)._id,
          paymentNumber: i,
          dueDate,
          principalAmount: actualPrincipal,
          interestAmount,
          totalAmount,
          status: LoanPaymentStatus.SCHEDULED,
        });

        remainingPrincipal -= actualPrincipal;
      }
    }

    if (payments.length > 0) {
      await this.paymentModel.insertMany(payments);
    }
  }

  private getMonthsPerPeriod(frequency: string): number {
    switch (frequency) {
      case 'MONTHLY': return 1;
      case 'QUARTERLY': return 3;
      case 'SEMI_ANNUALLY': return 6;
      case 'ANNUALLY': return 12;
      default: return 1;
    }
  }

  // ─── Record Payment ─────────────────────────────────────────────

  async recordPayment(dto: RecordLoanPaymentDto, user: JwtPayload): Promise<LoanPayment> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const payment = await this.paymentModel.findOne({
        loanId: new Types.ObjectId(dto.loanId),
        paymentNumber: dto.paymentNumber,
      }).session(session);

      if (!payment) throw new NotFoundException('Không tìm thấy kỳ thanh toán');
      if (payment.status === LoanPaymentStatus.PAID) {
        throw new BadRequestException('Kỳ thanh toán này đã được ghi nhận');
      }

      const paidAmount = dto.amount ?? payment.totalAmount;

      payment.status = paidAmount >= payment.totalAmount
        ? LoanPaymentStatus.PAID
        : LoanPaymentStatus.PARTIAL;
      payment.paidDate = new Date(dto.paidDate);
      payment.paymentMethod = dto.paymentMethod;
      payment.reference = dto.reference;
      payment.notes = dto.notes;
      payment.paidById = new Types.ObjectId(user._id);
      payment.paidByName = user.fullName;
      await payment.save({ session });

      // Update loan totals
      const loan = await this.loanModel.findOneAndUpdate(
        { _id: new Types.ObjectId(dto.loanId) },
        { $inc: { totalPaid: paidAmount, remainingBalance: -payment.principalAmount } },
        { new: true, session },
      );

      if (!loan) throw new NotFoundException('Không tìm thấy khoản vay');

      // Check if all payments are done
      const pendingCount = await this.paymentModel.countDocuments({
        loanId: new Types.ObjectId(dto.loanId),
        status: { $ne: LoanPaymentStatus.PAID },
      }).session(session);

      if (pendingCount === 0) {
        loan.status = LoanStatus.COMPLETED;
        loan.remainingBalance = 0;
        await loan.save({ session });
      }

      await session.commitTransaction();

      // Record bank transaction (outside main transaction for independence)
      if (loan.bankAccountId) {
        try {
          await this.financialControlService.recordBankTransaction({
            bankAccountId: loan.bankAccountId.toString(),
            type: 'WITHDRAWAL',
            category: 'LOAN_REPAYMENT',
            amount: paidAmount,
            transactionDate: dto.paidDate,
            description: `Trả nợ kỳ ${dto.paymentNumber} - ${loan.loanCode} (${loan.lenderName})`,
            reference: loan.loanCode,
            referenceId: (loan as any)._id.toString(),
            referenceType: 'LOAN',
          }, user);
        } catch {
          // Bank transaction failure should not rollback loan payment
        }
      }

      return payment;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ─── Payment Queries ────────────────────────────────────────────

  async findPayments(query: QueryLoanPaymentDto): Promise<LoanPayment[]> {
    const filter: any = {};
    if (query.loanId) filter.loanId = new Types.ObjectId(query.loanId);
    if (query.status) filter.status = query.status;
    if (query.startDate || query.endDate) {
      filter.dueDate = {};
      if (query.startDate) filter.dueDate.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.dueDate.$lte = end;
      }
    }
    return this.paymentModel.find(filter).sort({ dueDate: 1 }).limit(1000).exec();
  }

  // ─── Loan Summary ───────────────────────────────────────────────

  async getLoanSummary(): Promise<any> {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [activeLoans, overduePayments, upcomingPayments, totalInterestPaid] = await Promise.all([
      this.loanModel.aggregate([
        { $match: { status: LoanStatus.ACTIVE } },
        {
          $group: {
            _id: null,
            totalDebt: { $sum: '$remainingBalance' },
            totalPrincipal: { $sum: '$principal' },
            count: { $sum: 1 },
          },
        },
      ]),

      this.paymentModel.aggregate([
        { $match: { status: LoanPaymentStatus.OVERDUE } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),

      this.paymentModel.aggregate([
        {
          $match: {
            status: { $in: [LoanPaymentStatus.SCHEDULED, LoanPaymentStatus.OVERDUE] },
            dueDate: { $lte: in30Days },
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),

      this.paymentModel.aggregate([
        { $match: { status: LoanPaymentStatus.PAID } },
        { $group: { _id: null, totalInterest: { $sum: '$interestAmount' }, totalPaid: { $sum: '$totalAmount' } } },
      ]),
    ]);

    return {
      totalDebt: activeLoans[0]?.totalDebt || 0,
      totalPrincipal: activeLoans[0]?.totalPrincipal || 0,
      activeLoanCount: activeLoans[0]?.count || 0,
      overdueAmount: overduePayments[0]?.total || 0,
      overdueCount: overduePayments[0]?.count || 0,
      upcomingPayments30d: upcomingPayments[0]?.total || 0,
      upcomingPaymentCount30d: upcomingPayments[0]?.count || 0,
      totalInterestPaid: totalInterestPaid[0]?.totalInterest || 0,
      totalAmountPaid: totalInterestPaid[0]?.totalPaid || 0,
    };
  }

  // ─── Update Overdue ─────────────────────────────────────────────

  async updateOverduePayments(): Promise<{ updated: number }> {
    const result = await this.paymentModel.updateMany(
      {
        status: LoanPaymentStatus.SCHEDULED,
        dueDate: { $lt: new Date() },
      },
      { $set: { status: LoanPaymentStatus.OVERDUE } },
    );
    return { updated: result.modifiedCount };
  }
}
