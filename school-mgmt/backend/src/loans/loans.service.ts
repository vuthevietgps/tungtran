import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Model, Types, Connection } from 'mongoose';
import { randomBytes } from 'crypto';
import { Loan, LoanDocument, LoanStatus } from './schemas/loan.schema';
import { LoanPayment, LoanPaymentDocument, LoanPaymentStatus } from './schemas/loan-payment.schema';
import { CreateLoanDto, UpdateLoanDto, RecordLoanPaymentDto, QueryLoanDto, QueryLoanPaymentDto } from './dto/loan.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { FinancialControlBankFundService } from '../financial-control/financial-control-bank-fund.service';

@Injectable()
export class LoansService {
  constructor(
    @InjectModel(Loan.name) private loanModel: Model<LoanDocument>,
    @InjectModel(LoanPayment.name) private paymentModel: Model<LoanPaymentDocument>,
    @InjectConnection() private connection: Connection,
    private bankFundService: FinancialControlBankFundService,
  ) {}

  // ─── Code generation ─────────────────────────────────────────────
  private buildCode(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}${suffix}`;
  }

  private buildPaymentCode(loanCode: string, paymentNumber: number): string {
    return `LP-${loanCode}-${String(paymentNumber).padStart(3, '0')}`;
  }

  private isDuplicateKeyError(error: any, field?: string): boolean {
    if (!error || error.code !== 11000) return false;
    if (!field) return true;
    if (error.keyPattern && error.keyPattern[field]) return true;
    if (error.keyValue && error.keyValue[field] !== undefined) return true;
    return typeof error.message === 'string' && error.message.includes(field);
  }

  private async generateLoanCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.buildCode('LOAN');
      const exists = await this.loanModel.findOne({ loanCode: code }).select({ _id: 1 }).lean();
      if (!exists) return code;
    }
    throw new BadRequestException('Khong the sinh ma khoan vay duy nhat');
  }

  // ─── CRUD ────────────────────────────────────────────────────────

  async create(dto: CreateLoanDto, user: JwtPayload): Promise<Loan> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + dto.term);

    for (let attempt = 0; attempt < 5; attempt++) {
      const loanCode = await this.generateLoanCode();
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

      try {
        return await loan.save();
      } catch (err) {
        if (this.isDuplicateKeyError(err, 'loanCode') && attempt < 4) {
          continue;
        }
        throw err;
      }
    }

    throw new BadRequestException('Khong the tao khoan vay do xung dot ma dinh danh');
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
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const approvedAt = new Date();
      const loan = await this.loanModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), status: LoanStatus.DRAFT },
        {
          $set: {
            status: LoanStatus.ACTIVE,
            approvedById: new Types.ObjectId(user._id),
            approvedByName: user.fullName,
            approvedAt,
          },
        },
        { new: true, session },
      ).exec();

      if (!loan) {
        const existed = await this.loanModel.findById(id).session(session).exec();
        if (!existed) throw new NotFoundException('Khong tim thay khoan vay');
        throw new BadRequestException('Chi co the kich hoat khoan vay o trang thai Nhap');
      }

      await this.generatePaymentSchedule(loan, session);

      if (loan.principal > 0) {
        const disbursementBankAccountId = await this.resolveActiveBankAccountId(
          loan.bankAccountId as any,
          session,
          'giai ngan khoan vay',
        );
        await this.bankFundService.recordBankTransaction({
          bankAccountId: disbursementBankAccountId,
          type: 'DEPOSIT',
          category: 'LOAN_DISBURSEMENT',
          amount: loan.principal,
          transactionDate: loan.startDate.toISOString(),
          description: `Giai ngan khoan vay ${loan.loanCode} tu ${loan.lenderName}`,
          reference: loan.loanCode,
          referenceId: (loan as any)._id.toString(),
          referenceType: 'LOAN',
        }, user, { session });
      }

      await session.commitTransaction();
      return loan;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  private async generatePaymentSchedule(loan: LoanDocument, session: ClientSession): Promise<void> {
    const monthsPerPeriod = this.getMonthsPerPeriod(loan.paymentFrequency);
    const totalPeriods = Math.ceil(loan.term / monthsPerPeriod);
    const periodicRate = (loan.interestRate / 100) / (12 / monthsPerPeriod);

    const payments: any[] = [];
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

        const paymentCode = this.buildPaymentCode(loan.loanCode, i);

        payments.push({
          paymentCode,
          loanId: (loan as any)._id,
          paymentNumber: i,
          dueDate,
          principalAmount,
          interestAmount,
          totalAmount,
          paidAmount: 0,
          paidPrincipal: 0,
          paidInterest: 0,
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

        const paymentCode = this.buildPaymentCode(loan.loanCode, i);

        payments.push({
          paymentCode,
          loanId: (loan as any)._id,
          paymentNumber: i,
          dueDate,
          principalAmount: actualPrincipal,
          interestAmount,
          totalAmount,
          paidAmount: 0,
          paidPrincipal: 0,
          paidInterest: 0,
          status: LoanPaymentStatus.SCHEDULED,
        });

        remainingPrincipal -= actualPrincipal;
      }
    }

    await this.paymentModel.deleteMany({ loanId: (loan as any)._id }).session(session);
    if (payments.length > 0) {
      await this.paymentModel.insertMany(payments, { session });
    }
  }

  private getOutstandingAmount(payment: Pick<LoanPayment, 'totalAmount' | 'paidAmount'>): number {
    return Math.max((payment.totalAmount || 0) - (payment.paidAmount || 0), 0);
  }

  private getOutstandingPrincipal(payment: Pick<LoanPayment, 'principalAmount' | 'paidPrincipal'>): number {
    return Math.max((payment.principalAmount || 0) - (payment.paidPrincipal || 0), 0);
  }

  private getOutstandingInterest(payment: Pick<LoanPayment, 'interestAmount' | 'paidInterest'>): number {
    return Math.max((payment.interestAmount || 0) - (payment.paidInterest || 0), 0);
  }

  private getPaymentOutstandingExpr(): any {
    return {
      $max: [
        0,
        {
          $subtract: [
            '$totalAmount',
            { $ifNull: ['$paidAmount', 0] },
          ],
        },
      ],
    };
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

  private async resolveActiveBankAccountId(
    requestedBankAccountId: Types.ObjectId | string | undefined,
    session: ClientSession,
    context: string,
  ): Promise<string> {
    if (typeof (this.connection as any).model !== 'function') {
      if (requestedBankAccountId) {
        return requestedBankAccountId.toString();
      }
      throw new BadRequestException(
        `Khong co tai khoan ngan hang de ghi nhan giao dich ${context}`,
      );
    }

    const BankAccountModel = this.connection.model('BankAccount');

    if (requestedBankAccountId) {
      const bankAccountId = requestedBankAccountId.toString();
      if (!Types.ObjectId.isValid(bankAccountId)) {
        throw new BadRequestException('bankAccountId khong hop le');
      }

      const requested = await BankAccountModel.findOne({
        _id: new Types.ObjectId(bankAccountId),
        status: 'ACTIVE',
      })
        .select({ _id: 1 })
        .session(session)
        .lean();

      if (!requested) {
        throw new BadRequestException('Tai khoan ngan hang khong ton tai hoac khong ACTIVE');
      }
      return (requested as any)._id.toString();
    }

    const fallback = await BankAccountModel.findOne({ status: 'ACTIVE' })
      .sort({ isPrimary: -1, createdAt: -1 })
      .select({ _id: 1 })
      .session(session)
      .lean();

    if (!fallback) {
      throw new BadRequestException(
        `Khong co tai khoan ngan hang ACTIVE de ghi nhan giao dich ${context}`,
      );
    }

    return (fallback as any)._id.toString();
  }

  async recordPayment(dto: RecordLoanPaymentDto, user: JwtPayload): Promise<LoanPayment> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const payment = await this.paymentModel.findOne({
        loanId: new Types.ObjectId(dto.loanId),
        paymentNumber: dto.paymentNumber,
      }).session(session);

      if (!payment) throw new NotFoundException('Khong tim thay ky thanh toan');
      if (payment.status === LoanPaymentStatus.PAID) {
        throw new BadRequestException('Ky thanh toan nay da duoc ghi nhan');
      }

      const outstandingAmount = this.getOutstandingAmount(payment);
      if (outstandingAmount <= 0) {
        throw new BadRequestException('Ky thanh toan khong con so du can thu');
      }

      const paidAmount = dto.amount ?? outstandingAmount;
      if (paidAmount <= 0) {
        throw new BadRequestException('So tien thanh toan phai lon hon 0');
      }
      if (paidAmount > outstandingAmount + 0.0001) {
        throw new BadRequestException(`So tien thanh toan vuot qua so con lai cua ky (${outstandingAmount})`);
      }

      const outstandingInterest = this.getOutstandingInterest(payment);
      const outstandingPrincipal = this.getOutstandingPrincipal(payment);

      let allocationLeft = paidAmount;
      const paidInterest = Math.min(allocationLeft, outstandingInterest);
      allocationLeft -= paidInterest;
      const paidPrincipal = Math.min(allocationLeft, outstandingPrincipal);
      allocationLeft -= paidPrincipal;

      if (allocationLeft > 0.0001) {
        throw new BadRequestException('Khong the phan bo so tien thanh toan vao goc/lai');
      }

      payment.paidAmount = (payment.paidAmount || 0) + paidAmount;
      payment.paidInterest = (payment.paidInterest || 0) + paidInterest;
      payment.paidPrincipal = (payment.paidPrincipal || 0) + paidPrincipal;
      payment.status = this.getOutstandingAmount(payment) <= 0.0001
        ? LoanPaymentStatus.PAID
        : LoanPaymentStatus.PARTIAL;
      payment.paidDate = new Date(dto.paidDate);
      payment.paymentMethod = dto.paymentMethod;
      payment.reference = dto.reference;
      payment.notes = dto.notes;
      payment.paidById = new Types.ObjectId(user._id);
      payment.paidByName = user.fullName;
      await payment.save({ session });

      const loan = await this.loanModel.findOneAndUpdate(
        { _id: new Types.ObjectId(dto.loanId) },
        { $inc: { totalPaid: paidAmount, remainingBalance: -paidPrincipal } },
        { new: true, session },
      );

      if (!loan) throw new NotFoundException('Khong tim thay khoan vay');

      if (loan.remainingBalance < 0) {
        loan.remainingBalance = 0;
        await loan.save({ session });
      }

      const pendingCount = await this.paymentModel.countDocuments({
        loanId: new Types.ObjectId(dto.loanId),
        status: { $ne: LoanPaymentStatus.PAID },
      }).session(session);

      if (pendingCount === 0) {
        loan.status = LoanStatus.COMPLETED;
        loan.remainingBalance = 0;
        await loan.save({ session });
      }

      if (paidAmount > 0) {
        const repaymentBankAccountId = await this.resolveActiveBankAccountId(
          loan.bankAccountId as any,
          session,
          'tra no khoan vay',
        );
        await this.bankFundService.recordBankTransaction({
          bankAccountId: repaymentBankAccountId,
          type: 'WITHDRAWAL',
          category: 'LOAN_REPAYMENT',
          amount: paidAmount,
          transactionDate: dto.paidDate,
          description: `Tra no ky ${dto.paymentNumber} - ${loan.loanCode} (${loan.lenderName})`,
          reference: loan.loanCode,
          referenceId: (loan as any)._id.toString(),
          referenceType: 'LOAN',
        }, user, { session });
      }

      await session.commitTransaction();
      return payment;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

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
    const outstandingExpr = this.getPaymentOutstandingExpr();

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
        {
          $group: {
            _id: null,
            total: { $sum: outstandingExpr },
            count: { $sum: 1 },
          },
        },
      ]),

      this.paymentModel.aggregate([
        {
          $match: {
            status: { $in: [LoanPaymentStatus.SCHEDULED, LoanPaymentStatus.OVERDUE, LoanPaymentStatus.PARTIAL] },
            dueDate: { $lte: in30Days },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: outstandingExpr },
            count: { $sum: 1 },
          },
        },
      ]),

      this.paymentModel.aggregate([
        { $match: { status: { $in: [LoanPaymentStatus.PAID, LoanPaymentStatus.PARTIAL, LoanPaymentStatus.OVERDUE] } } },
        {
          $group: {
            _id: null,
            totalInterest: {
              $sum: {
                $ifNull: [
                  '$paidInterest',
                  {
                    $cond: [{ $eq: ['$status', LoanPaymentStatus.PAID] }, '$interestAmount', 0],
                  },
                ],
              },
            },
            totalPaid: {
              $sum: {
                $ifNull: [
                  '$paidAmount',
                  {
                    $cond: [{ $eq: ['$status', LoanPaymentStatus.PAID] }, '$totalAmount', 0],
                  },
                ],
              },
            },
          },
        },
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
        status: { $in: [LoanPaymentStatus.SCHEDULED, LoanPaymentStatus.PARTIAL] },
        dueDate: { $lt: new Date() },
      },
      { $set: { status: LoanPaymentStatus.OVERDUE } },
    );
    return { updated: result.modifiedCount };
  }
}

