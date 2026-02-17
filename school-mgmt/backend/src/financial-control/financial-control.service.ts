import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { BankAccount, BankAccountDocument } from './schemas/bank-account.schema';
import { BankTransaction, BankTransactionDocument, BankTransactionType } from './schemas/bank-transaction.schema';
import { Fund, FundDocument, FundStatus } from './schemas/fund.schema';
import { FundTransaction, FundTransactionDocument, FundTransactionType } from './schemas/fund-transaction.schema';
import {
  CreateBankAccountDto, UpdateBankAccountDto,
  RecordBankTransactionDto, QueryBankTransactionDto,
} from './dto/bank-account.dto';
import {
  CreateFundDto, UpdateFundDto,
  FundTransactionDto, QueryFundTransactionDto,
  QueryCashFlowDto,
} from './dto/fund.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

// Import related schemas for cash flow aggregation
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Payroll, PayrollDocument } from '../payroll/schemas/payroll.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { LedgerEntry, LedgerEntryDocument } from '../wallets/schemas/ledger-entry.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { AdCost, AdCostDocument } from '../ads/schemas/ad-cost.schema';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Loan, LoanDocument } from '../loans/schemas/loan.schema';
import { LoanPayment, LoanPaymentDocument } from '../loans/schemas/loan-payment.schema';

@Injectable()
export class FinancialControlService {
  constructor(
    @InjectModel(BankAccount.name) private bankAccountModel: Model<BankAccountDocument>,
    @InjectModel(BankTransaction.name) private bankTransactionModel: Model<BankTransactionDocument>,
    @InjectModel(Fund.name) private fundModel: Model<FundDocument>,
    @InjectModel(FundTransaction.name) private fundTransactionModel: Model<FundTransactionDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Loan.name) private loanModel2: Model<LoanDocument>,
    @InjectModel(LoanPayment.name) private loanPaymentModel: Model<LoanPaymentDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  // ─── Safe code generation with collision retry ────────────────────
  private async generateCode(model: Model<any>, prefix: string, pad: number): Promise<string> {
    const codeField = prefix.startsWith('BA-') ? 'accountCode' : prefix.startsWith('FUND-') ? 'fundCode' : 'transactionCode';
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await model.countDocuments();
      const code = `${prefix}${String(count + 1 + attempt).padStart(pad, '0')}`;
      const exists = await model.findOne({ [codeField]: code }).lean();
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  // ════════════════════════════════════════════════════════════════════
  // BANK ACCOUNTS — Số dư ngân hàng
  // ════════════════════════════════════════════════════════════════════

  async createBankAccount(dto: CreateBankAccountDto, user: JwtPayload): Promise<BankAccount> {
    const accountCode = await this.generateCode(this.bankAccountModel, 'BA-', 3);

    if (dto.isPrimary) {
      await this.bankAccountModel.updateMany({}, { isPrimary: false });
    }

    const account = new this.bankAccountModel({
      ...dto,
      accountCode,
      currentBalance: dto.openingBalance || 0,
      openingBalance: dto.openingBalance || 0,
      createdById: user._id,
      createdByName: user.fullName,
    });

    return account.save();
  }

  async findAllBankAccounts(): Promise<BankAccount[]> {
    return this.bankAccountModel.find().sort({ isPrimary: -1, createdAt: -1 }).exec();
  }

  async findBankAccount(id: string): Promise<BankAccountDocument> {
    const account = await this.bankAccountModel.findById(id).exec();
    if (!account) throw new NotFoundException('Bank account not found');
    return account;
  }

  async updateBankAccount(id: string, dto: UpdateBankAccountDto, user: JwtPayload): Promise<BankAccount> {
    const account = await this.findBankAccount(id);
    if (dto.isPrimary) {
      await this.bankAccountModel.updateMany({ _id: { $ne: id } }, { isPrimary: false });
    }
    Object.assign(account, dto);
    return account.save();
  }

  async getBankAccountSummary(): Promise<any> {
    const accounts = await this.bankAccountModel.find({ status: 'ACTIVE' }).lean();
    const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
    const primaryAccount = accounts.find(a => a.isPrimary);

    return {
      totalBalance,
      accountCount: accounts.length,
      primaryAccount: primaryAccount || null,
      accounts: accounts.map(a => ({
        _id: a._id,
        accountCode: a.accountCode,
        bankName: a.bankName,
        accountNumber: a.accountNumber,
        currentBalance: a.currentBalance,
        isPrimary: a.isPrimary,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // BANK TRANSACTIONS — Giao dịch ngân hàng
  // ════════════════════════════════════════════════════════════════════

  async recordBankTransaction(dto: RecordBankTransactionDto, user: JwtPayload): Promise<BankTransaction> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      // Atomic read-lock via findOneAndUpdate to prevent race conditions
      const isInflow = [BankTransactionType.DEPOSIT, BankTransactionType.TRANSFER_IN, BankTransactionType.INTEREST].includes(dto.type as BankTransactionType);
      const isOutflow = [BankTransactionType.WITHDRAWAL, BankTransactionType.TRANSFER_OUT, BankTransactionType.FEE].includes(dto.type as BankTransactionType);

      let delta = dto.amount;
      if (isOutflow) delta = -dto.amount;
      // ADJUSTMENT keeps original sign

      const account = await this.bankAccountModel.findOneAndUpdate(
        { _id: new Types.ObjectId(dto.bankAccountId) },
        { $inc: { currentBalance: delta } },
        { new: false, session }, // returns the doc BEFORE update
      ).exec();

      if (!account) throw new NotFoundException('Bank account not found');

      const balanceBefore = account.currentBalance;
      const balanceAfter = balanceBefore + delta;

      const transactionCode = await this.generateCode(this.bankTransactionModel, 'BT-', 5);

      const [transaction] = await this.bankTransactionModel.create([{
        transactionCode,
        bankAccountId: new Types.ObjectId(dto.bankAccountId),
        type: dto.type,
        category: dto.category || 'OTHER',
        amount: Math.abs(dto.amount),
        balanceBefore,
        balanceAfter,
        transactionDate: new Date(dto.transactionDate),
        description: dto.description,
        reference: dto.reference,
        referenceId: dto.referenceId ? new Types.ObjectId(dto.referenceId) : undefined,
        referenceType: dto.referenceType,
        recordedById: user._id,
        recordedByName: user.fullName,
      }], { session });

      await session.commitTransaction();
      return transaction;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async findBankTransactions(query: QueryBankTransactionDto): Promise<BankTransaction[]> {
    const filter: any = {};
    if (query.bankAccountId) filter.bankAccountId = new Types.ObjectId(query.bankAccountId);
    if (query.type) filter.type = query.type;
    if (query.category) filter.category = query.category;
    if (query.keyword) {
      filter.$or = [
        { transactionCode: new RegExp(query.keyword, 'i') },
        { description: new RegExp(query.keyword, 'i') },
        { reference: new RegExp(query.keyword, 'i') },
      ];
    }
    if (query.startDate || query.endDate) {
      filter.transactionDate = {};
      if (query.startDate) filter.transactionDate.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.transactionDate.$lte = end;
      }
    }
    return this.bankTransactionModel.find(filter).sort({ transactionDate: -1, createdAt: -1 }).limit(500).exec();
  }

  async reconcileTransaction(id: string, user: JwtPayload): Promise<BankTransaction> {
    const tx = await this.bankTransactionModel.findById(id).exec();
    if (!tx) throw new NotFoundException('Transaction not found');
    tx.isReconciled = true;
    tx.reconciledAt = new Date();
    tx.reconciledByName = user.fullName;
    return tx.save();
  }

  // ════════════════════════════════════════════════════════════════════
  // FUNDS — Quỹ đặt chỗ / Dự phòng / Tiền mặt
  // ════════════════════════════════════════════════════════════════════

  async createFund(dto: CreateFundDto, user: JwtPayload): Promise<Fund> {
    const fundCode = await this.generateCode(this.fundModel, 'FUND-', 3);

    const fund = new this.fundModel({
      ...dto,
      fundCode,
      currentBalance: dto.currentBalance || 0,
      totalDeposited: dto.currentBalance || 0,
      createdById: user._id,
      createdByName: user.fullName,
    });

    return fund.save();
  }

  async findAllFunds(): Promise<Fund[]> {
    return this.fundModel.find().sort({ fundType: 1, createdAt: -1 }).exec();
  }

  async findFund(id: string): Promise<FundDocument> {
    const fund = await this.fundModel.findById(id).exec();
    if (!fund) throw new NotFoundException('Fund not found');
    return fund;
  }

  async updateFund(id: string, dto: UpdateFundDto): Promise<Fund> {
    const fund = await this.findFund(id);
    Object.assign(fund, dto);
    return fund.save();
  }

  async recordFundTransaction(dto: FundTransactionDto, user: JwtPayload): Promise<FundTransaction> {
    const fund = await this.findFund(dto.fundId);

    if (fund.status !== FundStatus.ACTIVE) {
      throw new BadRequestException('Quỹ không ở trạng thái hoạt động');
    }

    // Validate withdrawal balance before starting transaction
    if (dto.type === FundTransactionType.WITHDRAW && dto.amount > fund.currentBalance) {
      throw new BadRequestException(`Số dư quỹ không đủ. Hiện có: ${fund.currentBalance.toLocaleString()}đ`);
    }

    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      let delta = dto.amount;
      const incUpdate: any = { currentBalance: delta };

      switch (dto.type) {
        case FundTransactionType.DEPOSIT:
          incUpdate.totalDeposited = dto.amount;
          break;
        case FundTransactionType.WITHDRAW:
          delta = -dto.amount;
          incUpdate.currentBalance = delta;
          incUpdate.totalWithdrawn = dto.amount;
          break;
        case FundTransactionType.ADJUSTMENT:
          // delta keeps original sign
          break;
        default:
          throw new BadRequestException('Invalid transaction type');
      }

      const updatedFund = await this.fundModel.findOneAndUpdate(
        { _id: new Types.ObjectId(dto.fundId) },
        { $inc: incUpdate },
        { new: false, session },
      ).exec();

      if (!updatedFund) throw new NotFoundException('Fund not found');

      const balanceBefore = updatedFund.currentBalance;
      const balanceAfter = balanceBefore + delta;

      const transactionCode = await this.generateCode(this.fundTransactionModel, 'FT-', 5);

      const [transaction] = await this.fundTransactionModel.create([{
        transactionCode,
        fundId: new Types.ObjectId(dto.fundId),
        type: dto.type,
        amount: dto.amount,
        balanceBefore,
        balanceAfter,
        transactionDate: new Date(dto.transactionDate),
        description: dto.description,
        reference: dto.reference,
        performedById: user._id,
        performedByName: user.fullName,
      }], { session });

      await session.commitTransaction();
      return transaction;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async findFundTransactions(query: QueryFundTransactionDto): Promise<FundTransaction[]> {
    const filter: any = {};
    if (query.fundId) filter.fundId = new Types.ObjectId(query.fundId);
    if (query.type) filter.type = query.type;
    if (query.startDate || query.endDate) {
      filter.transactionDate = {};
      if (query.startDate) filter.transactionDate.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.transactionDate.$lte = end;
      }
    }
    return this.fundTransactionModel.find(filter).sort({ transactionDate: -1 }).limit(500).exec();
  }

  async getFundsSummary(): Promise<any> {
    const funds = await this.fundModel.find({ status: FundStatus.ACTIVE }).lean();
    const totalBalance = funds.reduce((sum, f) => sum + f.currentBalance, 0);
    const warnings = funds.filter(f => f.currentBalance < f.minimumBalance);

    return {
      totalBalance,
      fundCount: funds.length,
      warningCount: warnings.length,
      warnings: warnings.map(f => ({
        fundCode: f.fundCode,
        name: f.name,
        currentBalance: f.currentBalance,
        minimumBalance: f.minimumBalance,
        deficit: f.minimumBalance - f.currentBalance,
      })),
      funds: funds.map(f => ({
        _id: f._id,
        fundCode: f.fundCode,
        name: f.name,
        fundType: f.fundType,
        currentBalance: f.currentBalance,
        minimumBalance: f.minimumBalance,
        targetBalance: f.targetBalance,
        progress: f.targetBalance > 0 ? Math.round((f.currentBalance / f.targetBalance) * 100) : 100,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // CASH FLOW — Dòng tiền tổng hợp
  // ════════════════════════════════════════════════════════════════════

  async getCashFlow(query: QueryCashFlowDto): Promise<any> {
    const dateFilter: any = {};
    if (query.startDate) dateFilter.$gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Aggregate data from all financial sources
    const [invoiceIncome, payrollOut, expenseOut, sessionRevenue, adCostOut, walletTopUps, loanDisbursements, loanRepayments] = await Promise.all([
      // Income from invoices (approved)
      this.invoiceModel.aggregate([
        {
          $match: {
            status: 'APPROVED',
            ...(hasDateFilter ? { paymentDate: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$paymentDate',
              },
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Payroll outflow
      this.payrollModel.aggregate([
        {
          $match: {
            status: 'PAID',
            ...(hasDateFilter ? { paidAt: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: { $ifNull: ['$paidAt', '$createdAt'] },
              },
            },
            totalAmount: { $sum: '$netAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Expense outflow (paid)
      this.expenseModel.aggregate([
        {
          $match: {
            paymentStatus: 'PAID',
            ...(hasDateFilter ? { expenseDate: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$expenseDate',
              },
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
            byCategory: { $push: { category: '$category', amount: '$amount' } },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Session revenue (finalized)
      this.sessionModel.aggregate([
        {
          $match: {
            status: 'FINALIZED',
            ...(hasDateFilter ? { scheduledDate: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$scheduledDate',
              },
            },
            totalRevenue: { $sum: '$amountCharged' },
            totalTeacherCost: { $sum: '$teacherPayout' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Ad costs outflow (marketing spend)
      this.adCostModel.aggregate([
        {
          $match: {
            ...(hasDateFilter ? { date: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$date',
              },
            },
            totalSpend: { $sum: '$spend' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Wallet top-ups (approved) — money received from parents
      this.ledgerModel.aggregate([
        {
          $match: {
            type: 'TOP_UP',
            status: 'APPROVED',
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Loan disbursements (inflow — money received from lenders)
      this.loanModel2.aggregate([
        {
          $match: {
            status: { $in: ['ACTIVE', 'COMPLETED'] },
            ...(hasDateFilter ? { startDate: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$startDate',
              },
            },
            totalAmount: { $sum: '$principal' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Loan repayments (outflow — money paid to lenders)
      this.loanPaymentModel.aggregate([
        {
          $match: {
            status: 'PAID',
            ...(hasDateFilter ? { paidDate: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$paidDate',
              },
            },
            totalAmount: { $sum: '$totalAmount' },
            totalPrincipal: { $sum: '$principalAmount' },
            totalInterest: { $sum: '$interestAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Build unified timeline
    const allDates = new Set<string>();
    invoiceIncome.forEach((i: any) => allDates.add(i._id));
    payrollOut.forEach((p: any) => allDates.add(p._id));
    expenseOut.forEach((e: any) => allDates.add(e._id));
    sessionRevenue.forEach((s: any) => allDates.add(s._id));
    adCostOut.forEach((a: any) => allDates.add(a._id));
    walletTopUps.forEach((w: any) => allDates.add(w._id));
    loanDisbursements.forEach((l: any) => allDates.add(l._id));
    loanRepayments.forEach((l: any) => allDates.add(l._id));

    const incomeMap = new Map(invoiceIncome.map((i: any) => [i._id, i]));
    const payrollMap = new Map(payrollOut.map((p: any) => [p._id, p]));
    const expenseMap = new Map(expenseOut.map((e: any) => [e._id, e]));
    const sessionMap = new Map(sessionRevenue.map((s: any) => [s._id, s]));
    const adCostMap = new Map(adCostOut.map((a: any) => [a._id, a]));
    const walletMap = new Map(walletTopUps.map((w: any) => [w._id, w]));
    const loanDisbMap = new Map(loanDisbursements.map((l: any) => [l._id, l]));
    const loanRepayMap = new Map(loanRepayments.map((l: any) => [l._id, l]));

    const timeline = Array.from(allDates).sort().map(date => {
      const income = incomeMap.get(date);
      const payroll = payrollMap.get(date);
      const expense = expenseMap.get(date);
      const session = sessionMap.get(date);
      const adCost = adCostMap.get(date);
      const wallet = walletMap.get(date);
      const loanDisb = loanDisbMap.get(date);
      const loanRepay = loanRepayMap.get(date);

      const totalInflow = (income?.totalAmount || 0) + (wallet?.totalAmount || 0) + (loanDisb?.totalAmount || 0);
      const totalOutflow = (payroll?.totalAmount || 0) + (expense?.totalAmount || 0) + (adCost?.totalSpend || 0) + (loanRepay?.totalAmount || 0);

      return {
        date,
        inflow: {
          invoices: income?.totalAmount || 0,
          invoiceCount: income?.count || 0,
          sessionRevenue: session?.totalRevenue || 0,
          sessionCount: session?.count || 0,
          walletTopUps: wallet?.totalAmount || 0,
          walletTopUpCount: wallet?.count || 0,
          loanDisbursements: loanDisb?.totalAmount || 0,
          loanDisbursementCount: loanDisb?.count || 0,
        },
        outflow: {
          payroll: payroll?.totalAmount || 0,
          payrollCount: payroll?.count || 0,
          expenses: expense?.totalAmount || 0,
          expenseCount: expense?.count || 0,
          teacherCost: session?.totalTeacherCost || 0,
          adCost: adCost?.totalSpend || 0,
          adCostCount: adCost?.count || 0,
          loanRepayments: loanRepay?.totalAmount || 0,
          loanRepaymentCount: loanRepay?.count || 0,
        },
        totalInflow,
        totalOutflow,
        netCashFlow: totalInflow - totalOutflow,
      };
    });

    // Calculate totals
    const totals = timeline.reduce(
      (acc, t) => ({
        totalInflow: acc.totalInflow + t.totalInflow,
        totalOutflow: acc.totalOutflow + t.totalOutflow,
        netCashFlow: acc.netCashFlow + t.netCashFlow,
      }),
      { totalInflow: 0, totalOutflow: 0, netCashFlow: 0 },
    );

    return {
      ...totals,
      timeline,
      period: {
        startDate: query.startDate || 'all',
        endDate: query.endDate || 'all',
        groupBy: query.groupBy || 'day',
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // P&L REPORT — Bảng cân đối thu chi
  // ════════════════════════════════════════════════════════════════════

  async getProfitAndLoss(startDate?: string, endDate?: string): Promise<any> {
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [
      sessionData,
      invoiceData,
      payrollData,
      expenseData,
      adCostData,
      loanInterestData,
    ] = await Promise.all([
      // Session revenue & teacher cost
      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', ...(hasDateFilter ? { scheduledDate: dateFilter } : {}) } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amountCharged' },
            totalTeacherCost: { $sum: '$teacherPayout' },
            sessionCount: { $sum: 1 },
          },
        },
      ]),

      // Invoice revenue by type
      this.invoiceModel.aggregate([
        { $match: { status: 'APPROVED', ...(hasDateFilter ? { paymentDate: dateFilter } : {}) } },
        {
          $group: {
            _id: '$invoiceType',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Payroll costs
      this.payrollModel.aggregate([
        { $match: { status: 'PAID', ...(hasDateFilter ? { paidAt: dateFilter } : {}) } },
        {
          $group: {
            _id: null,
            totalGross: { $sum: '$grossAmount' },
            totalNet: { $sum: '$netAmount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Operating expenses by category
      this.expenseModel.aggregate([
        { $match: { paymentStatus: 'PAID', ...(hasDateFilter ? { expenseDate: dateFilter } : {}) } },
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Ad costs (marketing spend) by platform
      this.adCostModel.aggregate([
        { $match: { ...(hasDateFilter ? { date: dateFilter } : {}) } },
        {
          $group: {
            _id: '$platform',
            totalSpend: { $sum: '$spend' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Loan interest expense (paid loan payments)
      this.loanPaymentModel.aggregate([
        { $match: { status: 'PAID', ...(hasDateFilter ? { paidDate: dateFilter } : {}) } },
        {
          $group: {
            _id: null,
            totalInterest: { $sum: '$interestAmount' },
            totalPaid: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Revenue breakdown
    const revenue = {
      sessionRevenue: sessionData[0]?.totalRevenue || 0,
      sessionCount: sessionData[0]?.sessionCount || 0,
      byInvoiceType: {} as Record<string, { amount: number; count: number }>,
    };
    invoiceData.forEach((i: any) => {
      revenue.byInvoiceType[i._id] = { amount: i.totalAmount, count: i.count };
    });
    const totalRevenue = revenue.sessionRevenue;

    // Cost breakdown
    const teacherCost = sessionData[0]?.totalTeacherCost || 0;
    const payrollCost = payrollData[0]?.totalNet || 0;

    const expenseByCategory: Record<string, { amount: number; count: number }> = {};
    let totalExpenses = 0;
    expenseData.forEach((e: any) => {
      expenseByCategory[e._id] = { amount: e.totalAmount, count: e.count };
      totalExpenses += e.totalAmount;
    });

    // Ad costs by platform
    const adCostByPlatform: Record<string, { amount: number; count: number }> = {};
    let totalAdCost = 0;
    adCostData.forEach((a: any) => {
      adCostByPlatform[a._id] = { amount: a.totalSpend, count: a.count };
      totalAdCost += a.totalSpend;
    });

    // Loan interest expense
    const interestExpense = loanInterestData[0]?.totalInterest || 0;

    const grossProfit = totalRevenue - teacherCost;
    const netProfit = grossProfit - totalExpenses - totalAdCost - interestExpense;

    return {
      period: { startDate: startDate || 'all', endDate: endDate || 'all' },
      revenue: {
        total: totalRevenue,
        ...revenue,
      },
      costs: {
        teacherCost,
        payrollCost,
        operatingExpenses: totalExpenses,
        expenseByCategory,
        adCost: totalAdCost,
        adCostByPlatform,
        interestExpense,
        totalCosts: teacherCost + totalExpenses + totalAdCost + interestExpense,
      },
      summary: {
        grossProfit,
        grossMargin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0,
        netProfit,
        netMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 10000) / 100 : 0,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // RECONCILIATION — Đối soát tài chính
  // ════════════════════════════════════════════════════════════════════

  async getReconciliationReport(startDate?: string, endDate?: string): Promise<any> {
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [bankSummary, fundsSummary, unreconciledCount, walletTotal, pnl, loanSummary] = await Promise.all([
      this.getBankAccountSummary(),
      this.getFundsSummary(),
      this.bankTransactionModel.countDocuments({ isReconciled: false }),
      this.getWalletTotals(),
      this.getProfitAndLoss(startDate, endDate),
      this.loanModel2.aggregate([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: null, totalDebt: { $sum: '$remainingBalance' }, count: { $sum: 1 } } },
      ]),
    ]);

    const totalLoanDebt = loanSummary[0]?.totalDebt || 0;
    const activeLoanCount = loanSummary[0]?.count || 0;

    return {
      bankAccounts: bankSummary,
      funds: fundsSummary,
      wallets: walletTotal,
      unreconciledTransactions: unreconciledCount,
      profitAndLoss: pnl.summary,
      loanSummary: {
        totalDebt: totalLoanDebt,
        activeLoanCount,
      },
      healthIndicators: {
        bankBalance: bankSummary.totalBalance,
        fundBalance: fundsSummary.totalBalance,
        walletLiability: walletTotal.totalBalance,
        loanDebt: totalLoanDebt,
        netPosition: bankSummary.totalBalance + fundsSummary.totalBalance - walletTotal.totalBalance - totalLoanDebt,
        unreconciledItems: unreconciledCount,
        fundWarnings: fundsSummary.warningCount,
      },
    };
  }

  private async getWalletTotals(): Promise<any> {
    const agg = await this.walletModel.aggregate([
      { $match: { status: { $ne: 'CLOSED' } } },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          count: { $sum: 1 },
        },
      },
    ]);
    return agg[0] || { totalBalance: 0, count: 0 };
  }

  // ════════════════════════════════════════════════════════════════════
  // FINANCIAL DASHBOARD — Bảng chỉ số tài chính quản trị
  // ════════════════════════════════════════════════════════════════════

  async getFinancialDashboard(): Promise<any> {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // 6 months ago for average calculation
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Last month for revenue growth
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      bankSummary,
      fundsSummary,
      marketingFunds,
      walletTotals,
      pendingPayroll,
      pendingExpenses,
      upcomingOrderPayments,
      avgMonthlyOutflows,
      pendingInvoices,
      thisMonthRevenue,
      lastMonthRevenue,
      pnl,
      loanDebtSummary,
      upcomingLoanPayments,
    ] = await Promise.all([
      // 1. Bank & Fund balances
      this.getBankAccountSummary(),
      this.getFundsSummary(),

      // 2. Marketing fund specifically
      this.fundModel.aggregate([
        { $match: { fundType: 'MARKETING', status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: '$currentBalance' }, count: { $sum: 1 } } },
      ]),

      // 3. Wallet totals (deferred revenue / liability)
      this.getWalletTotals(),

      // 4. Payroll APPROVED but not PAID
      this.payrollModel.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      ]),

      // 5. Expenses APPROVED_UNPAID
      this.expenseModel.aggregate([
        { $match: { paymentStatus: 'APPROVED_UNPAID' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),

      // 6. Order payment frames due within 14 days
      this.orderModel.aggregate([
        {
          $match: {
            status: { $nin: ['CANCELLED', 'REJECTED'] },
            'paymentFrames.dueDate': { $lte: in14Days, $gte: now },
            'paymentFrames.status': { $ne: 'PAID' },
          },
        },
        { $unwind: '$paymentFrames' },
        {
          $match: {
            'paymentFrames.dueDate': { $lte: in14Days, $gte: now },
            'paymentFrames.status': { $ne: 'PAID' },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$paymentFrames.amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // 7. Average monthly outflows (last 6 months) for burn rate
      Promise.all([
        this.payrollModel.aggregate([
          { $match: { status: 'PAID', paidAt: { $gte: sixMonthsAgo } } },
          { $group: { _id: null, total: { $sum: '$netAmount' } } },
        ]),
        this.expenseModel.aggregate([
          { $match: { paymentStatus: 'PAID', paidAt: { $gte: sixMonthsAgo } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        this.adCostModel.aggregate([
          { $match: { date: { $gte: sixMonthsAgo } } },
          { $group: { _id: null, total: { $sum: '$spend' } } },
        ]),
      ]),

      // 8. Pending invoices (money coming in)
      this.invoiceModel.aggregate([
        { $match: { status: 'PENDING_APPROVAL' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),

      // 9. This month revenue (sessions finalized)
      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', scheduledDate: { $gte: thisMonthStart } } },
        { $group: { _id: null, total: { $sum: '$amountCharged' } } },
      ]),

      // 10. Last month revenue
      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', scheduledDate: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$amountCharged' } } },
      ]),

      // 11. P&L for margins
      this.getProfitAndLoss(),

      // 12. Active loans total debt
      this.loanModel2.aggregate([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: null, totalDebt: { $sum: '$remainingBalance' }, totalPrincipal: { $sum: '$principal' }, count: { $sum: 1 } } },
      ]),

      // 13. Upcoming loan payments (next 30 days)
      this.loanPaymentModel.aggregate([
        {
          $match: {
            status: { $in: ['SCHEDULED', 'OVERDUE'] },
            dueDate: { $lte: in30Days },
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    // ── Calculate derived metrics ──

    const bankBalance = bankSummary.totalBalance || 0;
    const fundBalance = fundsSummary.totalBalance || 0;
    const marketingFundBalance = marketingFunds[0]?.total || 0;
    const availableCash = bankBalance + fundBalance;

    // Upcoming payables
    const payrollPayable = pendingPayroll[0]?.total || 0;
    const payrollPayableCount = pendingPayroll[0]?.count || 0;
    const expensePayable = pendingExpenses[0]?.total || 0;
    const expensePayableCount = pendingExpenses[0]?.count || 0;
    const orderPayable = upcomingOrderPayments[0]?.total || 0;
    const orderPayableCount = upcomingOrderPayments[0]?.count || 0;
    const loanPayable = upcomingLoanPayments[0]?.total || 0;
    const loanPayableCount = upcomingLoanPayments[0]?.count || 0;
    const totalDebt = loanDebtSummary[0]?.totalDebt || 0;
    const activeLoanCount = loanDebtSummary[0]?.count || 0;
    const totalPayable14Days = payrollPayable + expensePayable + orderPayable;

    // Burn rate (average monthly)
    const [payrollTotal6m, expenseTotal6m, adCostTotal6m] = avgMonthlyOutflows;
    const totalOutflow6m = (payrollTotal6m[0]?.total || 0) + (expenseTotal6m[0]?.total || 0) + (adCostTotal6m[0]?.total || 0);
    const burnRate = Math.round(totalOutflow6m / 6);
    const operatingReserve3Months = burnRate * 3;
    const runway = burnRate > 0 ? Math.round((availableCash / burnRate) * 10) / 10 : 999;

    // Deferred revenue & receivables
    const walletBalance = walletTotals.totalBalance || 0;
    const pendingInvoiceAmount = pendingInvoices[0]?.total || 0;
    const pendingInvoiceCount = pendingInvoices[0]?.count || 0;

    // Revenue growth
    const thisMonthRev = thisMonthRevenue[0]?.total || 0;
    const lastMonthRev = lastMonthRevenue[0]?.total || 0;
    const revenueGrowth = lastMonthRev > 0
      ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 10000) / 100
      : 0;

    // Accounting ratios
    const currentAssets = availableCash + pendingInvoiceAmount;
    const currentLiabilities = totalPayable14Days + walletBalance + loanPayable;
    const currentRatio = currentLiabilities > 0
      ? Math.round((currentAssets / currentLiabilities) * 100) / 100
      : 999;

    return {
      // Section 1: Cash position
      cashPosition: {
        bankBalance,
        bankAccountCount: bankSummary.accountCount || 0,
        fundBalance,
        fundCount: fundsSummary.fundCount || 0,
        marketingFund: marketingFundBalance,
        marketingFundCount: marketingFunds[0]?.count || 0,
        availableCash,
      },

      // Section 2: Obligations & Reserve
      obligations: {
        payrollPayable,
        payrollPayableCount,
        expensePayable,
        expensePayableCount,
        orderPayable,
        orderPayableCount,
        totalPayable14Days,
        operatingReserve3Months,
        burnRate,
        runway,
        reserveHealthy: availableCash >= operatingReserve3Months,
        cashAfterObligations: availableCash - totalPayable14Days,
      },

      // Section 3: Deferred revenue & receivables
      deferredRevenue: {
        walletBalance,
        walletCount: walletTotals.count || 0,
        pendingInvoiceAmount,
        pendingInvoiceCount,
      },

      // Section 4: Accounting metrics
      metrics: {
        burnRate,
        runway,
        currentRatio,
        grossMargin: pnl.summary.grossMargin,
        netMargin: pnl.summary.netMargin,
        grossProfit: pnl.summary.grossProfit,
        netProfit: pnl.summary.netProfit,
        revenueGrowth,
        thisMonthRevenue: thisMonthRev,
        lastMonthRevenue: lastMonthRev,
        accountsReceivable: pendingInvoiceAmount,
        accountsPayable: payrollPayable + expensePayable,
        deferredRevenue: walletBalance,
      },

      // Section 5: Debt position (loans)
      debtPosition: {
        totalDebt,
        activeLoanCount,
        loanPayable,
        loanPayableCount,
      },

      // Fund warnings
      fundWarnings: fundsSummary.warnings || [],
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // FINANCIAL OVERVIEW — Tổng quan tài chính cho Director
  // ════════════════════════════════════════════════════════════════════

  async getFinancialOverview(startDate?: string, endDate?: string): Promise<any> {
    const [bankSummary, fundsSummary, cashFlow, pnl] = await Promise.all([
      this.getBankAccountSummary(),
      this.getFundsSummary(),
      this.getCashFlow({ startDate, endDate, groupBy: 'month' }),
      this.getProfitAndLoss(startDate, endDate),
    ]);

    return {
      bankAccounts: bankSummary,
      funds: fundsSummary,
      cashFlow: {
        totalInflow: cashFlow.totalInflow,
        totalOutflow: cashFlow.totalOutflow,
        netCashFlow: cashFlow.netCashFlow,
        recentMonths: cashFlow.timeline.slice(-6),
      },
      profitAndLoss: pnl,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // FINANCIAL ALERTS — Cảnh báo & Chỉ dẫn hành động
  // ════════════════════════════════════════════════════════════════════

  async getFinancialAlerts(): Promise<any> {
    const [
      dashboard,
      fundsSummary,
      pnl,
      marketingBudgetNeeded,
      unreconciledCount,
      recentCashFlow,
      pendingExpenses,
      overdueOrders,
    ] = await Promise.all([
      this.getFinancialDashboard(),
      this.getFundsSummary(),
      this.getProfitAndLoss(),
      this.calculateOptimalMarketingBudget(),
      this.bankTransactionModel.countDocuments({ isReconciled: false }),
      this.getCashFlow({ groupBy: 'month' }),
      this.expenseModel.countDocuments({ paymentStatus: 'APPROVED_UNPAID' }),
      this.orderModel.aggregate([
        {
          $match: {
            status: { $nin: ['CANCELLED', 'REJECTED'] },
            'paymentFrames.dueDate': { $lt: new Date() },
            'paymentFrames.status': { $ne: 'PAID' },
          },
        },
        { $unwind: '$paymentFrames' },
        {
          $match: {
            'paymentFrames.dueDate': { $lt: new Date() },
            'paymentFrames.status': { $ne: 'PAID' },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$paymentFrames.amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const alerts: any[] = [];

    // ── 1. Quỹ Marketing vs chi phí ads tối ưu đề xuất ──
    const marketingFundBalance = dashboard.cashPosition.marketingFund || 0;
    const optimalAdsBudget = marketingBudgetNeeded.totalOptimalDailyBudget;
    const optimalMonthlyBudget = optimalAdsBudget * 30;

    if (optimalAdsBudget > 0) {
      const coverageMonths = optimalMonthlyBudget > 0
        ? Math.round((marketingFundBalance / optimalMonthlyBudget) * 10) / 10
        : 999;

      if (marketingFundBalance < optimalMonthlyBudget) {
        const deficit = optimalMonthlyBudget - marketingFundBalance;
        alerts.push({
          id: 'MARKETING_FUND_LOW',
          severity: marketingFundBalance < optimalMonthlyBudget * 0.5 ? 'CRITICAL' : 'WARNING',
          category: 'MARKETING',
          title: 'Quỹ Marketing không đủ cho chi phí QC tối ưu',
          message: `Quỹ Marketing hiện có ${marketingFundBalance.toLocaleString()}đ, nhưng ngân sách QC tối ưu đề xuất là ${optimalMonthlyBudget.toLocaleString()}đ/tháng (${optimalAdsBudget.toLocaleString()}đ/ngày). Chỉ đủ cho ${coverageMonths} tháng.`,
          data: {
            currentBalance: marketingFundBalance,
            optimalDailyBudget: optimalAdsBudget,
            optimalMonthlyBudget,
            deficit,
            coverageMonths,
            groupBreakdown: marketingBudgetNeeded.groupBreakdown,
          },
          actions: [
            { label: 'Nạp thêm quỹ Marketing', type: 'FUND_DEPOSIT', target: 'MARKETING', amount: deficit },
            { label: 'Xem phân tích QC & điều chỉnh ngân sách', type: 'NAVIGATE', target: '/ads-analytics' },
            { label: 'Giảm ngân sách QC các nhóm hiệu quả thấp', type: 'NAVIGATE', target: '/ads-management' },
          ],
        });
      } else {
        alerts.push({
          id: 'MARKETING_FUND_OK',
          severity: 'INFO',
          category: 'MARKETING',
          title: 'Quỹ Marketing đủ cho hoạt động QC',
          message: `Quỹ Marketing đủ cho ${coverageMonths} tháng QC tối ưu (${optimalMonthlyBudget.toLocaleString()}đ/tháng).`,
          data: { currentBalance: marketingFundBalance, optimalMonthlyBudget, coverageMonths },
          actions: [],
        });
      }
    }

    // ── 2. Runway cảnh báo ──
    const { runway, burnRate } = dashboard.obligations;
    if (runway < 2) {
      alerts.push({
        id: 'RUNWAY_CRITICAL',
        severity: 'CRITICAL',
        category: 'CASH_FLOW',
        title: 'Runway nguy hiểm — dưới 2 tháng',
        message: `Với tốc độ chi ${burnRate.toLocaleString()}đ/tháng, tiền khả dụng chỉ đủ hoạt động ${runway} tháng. Cần hành động ngay.`,
        data: { runway, burnRate, availableCash: dashboard.cashPosition.availableCash },
        actions: [
          { label: 'Cắt giảm chi phí vận hành', type: 'NAVIGATE', target: '/expenses' },
          { label: 'Thu hồi công nợ & hóa đơn chờ duyệt', type: 'NAVIGATE', target: '/invoices' },
          { label: 'Tạm dừng chiến dịch QC hiệu quả thấp', type: 'NAVIGATE', target: '/ads-management' },
        ],
      });
    } else if (runway < 4) {
      alerts.push({
        id: 'RUNWAY_WARNING',
        severity: 'WARNING',
        category: 'CASH_FLOW',
        title: 'Runway thấp — dưới 4 tháng',
        message: `Runway hiện tại ${runway} tháng. Nên duy trì ít nhất 6 tháng dự phòng.`,
        data: { runway, burnRate, availableCash: dashboard.cashPosition.availableCash },
        actions: [
          { label: 'Tối ưu chi phí', type: 'NAVIGATE', target: '/expenses' },
          { label: 'Đẩy mạnh thu học phí', type: 'NAVIGATE', target: '/orders' },
        ],
      });
    }

    // ── 3. Dự phòng hoạt động 3 tháng ──
    if (!dashboard.obligations.reserveHealthy) {
      const { operatingReserve3Months, cashAfterObligations } = dashboard.obligations;
      const shortfall = operatingReserve3Months - dashboard.cashPosition.availableCash;
      alerts.push({
        id: 'RESERVE_INSUFFICIENT',
        severity: 'WARNING',
        category: 'RESERVE',
        title: 'Tiền khả dụng chưa đủ dự phòng 3 tháng',
        message: `Cần ${operatingReserve3Months.toLocaleString()}đ dự phòng 3 tháng, hiện thiếu ${shortfall.toLocaleString()}đ.`,
        data: { required: operatingReserve3Months, shortfall, available: dashboard.cashPosition.availableCash },
        actions: [
          { label: 'Nạp quỹ dự phòng', type: 'FUND_DEPOSIT', target: 'RESERVE', amount: shortfall },
          { label: 'Rà soát & cắt chi phí không cần thiết', type: 'NAVIGATE', target: '/expenses' },
        ],
      });
    }

    // ── 4. Quỹ dưới mức tối thiểu ──
    for (const warning of (fundsSummary.warnings || [])) {
      alerts.push({
        id: `FUND_BELOW_MIN_${warning.fundCode}`,
        severity: 'WARNING',
        category: 'FUND',
        title: `Quỹ "${warning.name}" dưới mức tối thiểu`,
        message: `${warning.name} (${warning.fundCode}): Hiện có ${warning.currentBalance.toLocaleString()}đ, tối thiểu ${warning.minimumBalance.toLocaleString()}đ, thiếu ${warning.deficit.toLocaleString()}đ.`,
        data: warning,
        actions: [
          { label: `Nạp thêm ${warning.deficit.toLocaleString()}đ`, type: 'FUND_DEPOSIT', target: warning.fundCode, amount: warning.deficit },
        ],
      });
    }

    // ── 5. Nghĩa vụ thanh toán 14 ngày ──
    const { totalPayable14Days, cashAfterObligations } = dashboard.obligations;
    if (cashAfterObligations < 0) {
      alerts.push({
        id: 'OBLIGATIONS_EXCEED_CASH',
        severity: 'CRITICAL',
        category: 'OBLIGATIONS',
        title: 'Không đủ tiền thanh toán nghĩa vụ 14 ngày tới',
        message: `Tổng phải trả ${totalPayable14Days.toLocaleString()}đ trong 14 ngày, nhưng tiền khả dụng chỉ ${dashboard.cashPosition.availableCash.toLocaleString()}đ. Thiếu ${Math.abs(cashAfterObligations).toLocaleString()}đ.`,
        data: {
          totalPayable: totalPayable14Days,
          available: dashboard.cashPosition.availableCash,
          deficit: Math.abs(cashAfterObligations),
          payroll: dashboard.obligations.payrollPayable,
          expenses: dashboard.obligations.expensePayable,
          orders: dashboard.obligations.orderPayable,
        },
        actions: [
          { label: 'Thu hồi công nợ gấp', type: 'NAVIGATE', target: '/invoices' },
          { label: 'Hoãn chi lương / chi phí nếu có thể', type: 'INFO' },
          { label: 'Rút quỹ dự phòng', type: 'FUND_WITHDRAW', target: 'RESERVE' },
        ],
      });
    }

    // ── 6. Current Ratio thấp ──
    const { currentRatio } = dashboard.metrics;
    if (currentRatio < 1) {
      alerts.push({
        id: 'CURRENT_RATIO_DANGER',
        severity: 'CRITICAL',
        category: 'METRICS',
        title: 'Current Ratio < 1 — Rủi ro mất khả năng thanh toán',
        message: `Current Ratio = ${currentRatio}. Tài sản ngắn hạn nhỏ hơn nợ ngắn hạn, cần tăng doanh thu hoặc giảm nợ.`,
        data: { currentRatio },
        actions: [
          { label: 'Đẩy mạnh thu phí & giảm nợ', type: 'NAVIGATE', target: '/orders' },
          { label: 'Tối ưu chi phí VH', type: 'NAVIGATE', target: '/expenses' },
        ],
      });
    } else if (currentRatio < 1.5) {
      alerts.push({
        id: 'CURRENT_RATIO_LOW',
        severity: 'WARNING',
        category: 'METRICS',
        title: 'Current Ratio thấp (< 1.5)',
        message: `Current Ratio = ${currentRatio}. Nên duy trì >= 1.5 để đảm bảo thanh khoản.`,
        data: { currentRatio },
        actions: [
          { label: 'Xem chi tiết tài chính', type: 'NAVIGATE', target: '/financial-control' },
        ],
      });
    }

    // ── 7. Lợi nhuận ròng âm ──
    if (pnl.summary.netProfit < 0) {
      alerts.push({
        id: 'NET_PROFIT_NEGATIVE',
        severity: pnl.summary.netProfit < -pnl.revenue.total * 0.2 ? 'CRITICAL' : 'WARNING',
        category: 'PROFITABILITY',
        title: 'Lợi nhuận ròng âm — đang lỗ',
        message: `Lỗ ròng ${Math.abs(pnl.summary.netProfit).toLocaleString()}đ (biên lợi nhuận ${pnl.summary.netMargin}%). Cần rà soát cơ cấu chi phí.`,
        data: {
          netProfit: pnl.summary.netProfit,
          netMargin: pnl.summary.netMargin,
          revenue: pnl.revenue.total,
          totalCosts: pnl.costs.totalCosts,
        },
        actions: [
          { label: 'Xem P&L chi tiết', type: 'NAVIGATE', target: '/financial-control?tab=pnl' },
          { label: 'Rà soát chi phí giáo viên', type: 'NAVIGATE', target: '/sessions' },
          { label: 'Tăng giá hoặc đẩy enrollment', type: 'NAVIGATE', target: '/orders' },
        ],
      });
    }

    // ── 8. Giao dịch chưa đối soát ──
    if (unreconciledCount > 20) {
      alerts.push({
        id: 'UNRECONCILED_HIGH',
        severity: 'WARNING',
        category: 'RECONCILIATION',
        title: `${unreconciledCount} giao dịch chưa đối soát`,
        message: `Có ${unreconciledCount} giao dịch ngân hàng chưa được đối soát. Nên đối soát định kỳ để đảm bảo chính xác sổ sách.`,
        data: { count: unreconciledCount },
        actions: [
          { label: 'Đối soát giao dịch', type: 'NAVIGATE', target: '/financial-control?tab=bank' },
        ],
      });
    }

    // ── 9. Chi phí chờ thanh toán ──
    if (pendingExpenses > 5) {
      alerts.push({
        id: 'PENDING_EXPENSES',
        severity: 'INFO',
        category: 'EXPENSES',
        title: `${pendingExpenses} chi phí đã duyệt chưa thanh toán`,
        message: `Có ${pendingExpenses} khoản chi phí đã được duyệt nhưng chưa thanh toán. Nên xử lý sớm.`,
        data: { count: pendingExpenses },
        actions: [
          { label: 'Xem chi phí chờ thanh toán', type: 'NAVIGATE', target: '/expenses' },
        ],
      });
    }

    // ── 10. Đơn hàng quá hạn thanh toán ──
    const overdueAmount = overdueOrders[0]?.total || 0;
    const overdueCount = overdueOrders[0]?.count || 0;
    if (overdueCount > 0) {
      alerts.push({
        id: 'OVERDUE_PAYMENTS',
        severity: overdueAmount > burnRate * 0.5 ? 'CRITICAL' : 'WARNING',
        category: 'RECEIVABLE',
        title: `${overdueCount} kỳ thanh toán quá hạn`,
        message: `Có ${overdueCount} kỳ thanh toán quá hạn, tổng ${overdueAmount.toLocaleString()}đ. Cần nhắc nhở phụ huynh.`,
        data: { count: overdueCount, amount: overdueAmount },
        actions: [
          { label: 'Xem đơn hàng quá hạn', type: 'NAVIGATE', target: '/orders' },
          { label: 'Gửi nhắc nhở phụ huynh', type: 'INFO' },
        ],
      });
    }

    // ── 11. Dòng tiền ròng âm liên tục ──
    const recentMonths = recentCashFlow.timeline.slice(-3);
    const negativeMonths = recentMonths.filter((m: any) => m.netCashFlow < 0);
    if (negativeMonths.length >= 2) {
      const totalNegative = negativeMonths.reduce((s: number, m: any) => s + m.netCashFlow, 0);
      alerts.push({
        id: 'NEGATIVE_CASHFLOW_TREND',
        severity: negativeMonths.length >= 3 ? 'CRITICAL' : 'WARNING',
        category: 'CASH_FLOW',
        title: `Dòng tiền ròng âm ${negativeMonths.length}/${recentMonths.length} tháng gần đây`,
        message: `Dòng tiền ròng âm liên tục cho thấy chi tiêu đang vượt thu nhập. Tổng âm: ${totalNegative.toLocaleString()}đ.`,
        data: { negativeMonths: negativeMonths.length, totalNegative, recentMonths },
        actions: [
          { label: 'Phân tích dòng tiền chi tiết', type: 'NAVIGATE', target: '/financial-control?tab=cashflow' },
          { label: 'Rà soát các khoản chi lớn', type: 'NAVIGATE', target: '/expenses' },
          { label: 'Tăng tuyển sinh / marketing', type: 'NAVIGATE', target: '/ads-analytics' },
        ],
      });
    }

    // ── 12. Khoản vay quá hạn ──
    const loanOverduePayments = await this.loanPaymentModel.aggregate([
      { $match: { status: 'OVERDUE' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const loanOverdueAmount = loanOverduePayments[0]?.total || 0;
    const loanOverdueCount = loanOverduePayments[0]?.count || 0;
    if (loanOverdueCount > 0) {
      alerts.push({
        id: 'LOAN_OVERDUE_PAYMENTS',
        severity: loanOverdueAmount > burnRate * 0.3 ? 'CRITICAL' : 'WARNING',
        category: 'LOAN',
        title: `${loanOverdueCount} kỳ trả nợ vay quá hạn`,
        message: `Có ${loanOverdueCount} kỳ trả nợ vay quá hạn, tổng ${loanOverdueAmount.toLocaleString()}đ. Cần xử lý ngay để tránh phạt lãi.`,
        data: { count: loanOverdueCount, amount: loanOverdueAmount },
        actions: [
          { label: 'Xem khoản vay', type: 'NAVIGATE', target: '/loans' },
          { label: 'Thanh toán ngay', type: 'INFO' },
        ],
      });
    }

    // ── 13. Tỷ lệ nợ cao ──
    const loanTotalDebt = dashboard.debtPosition?.totalDebt || 0;
    if (loanTotalDebt > dashboard.cashPosition.availableCash) {
      alerts.push({
        id: 'LOAN_HIGH_DEBT_RATIO',
        severity: loanTotalDebt > dashboard.cashPosition.availableCash * 2 ? 'CRITICAL' : 'WARNING',
        category: 'LOAN',
        title: 'Tổng nợ vay vượt tiền khả dụng',
        message: `Tổng nợ vay ${loanTotalDebt.toLocaleString()}đ vượt tiền khả dụng ${dashboard.cashPosition.availableCash.toLocaleString()}đ. Cần cân nhắc chiến lược trả nợ.`,
        data: { totalDebt: loanTotalDebt, availableCash: dashboard.cashPosition.availableCash },
        actions: [
          { label: 'Xem chi tiết khoản vay', type: 'NAVIGATE', target: '/loans' },
          { label: 'Xem dòng tiền', type: 'NAVIGATE', target: '/financial-control?tab=cashflow' },
        ],
      });
    }

    // ── 14. Khoản vay sắp đáo hạn ──
    const in30DaysAlert = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
    const nearMaturityLoans = await this.loanModel2.find({
      status: 'ACTIVE',
      endDate: { $lte: in30DaysAlert },
    }).lean();
    for (const loan of nearMaturityLoans) {
      alerts.push({
        id: `LOAN_NEAR_MATURITY_${(loan as any)._id}`,
        severity: 'WARNING',
        category: 'LOAN',
        title: `Khoản vay ${(loan as any).loanCode} sắp đáo hạn`,
        message: `Khoản vay từ ${(loan as any).lenderName}, gốc ${(loan as any).principal.toLocaleString()}đ, còn nợ ${(loan as any).remainingBalance.toLocaleString()}đ, đáo hạn ${new Date((loan as any).endDate).toLocaleDateString('vi-VN')}.`,
        data: { loanCode: (loan as any).loanCode, remainingBalance: (loan as any).remainingBalance, endDate: (loan as any).endDate },
        actions: [
          { label: 'Xem khoản vay', type: 'NAVIGATE', target: '/loans' },
        ],
      });
    }

    // ── 15. Tăng trưởng doanh thu giảm ──
    const { revenueGrowth } = dashboard.metrics;
    if (revenueGrowth < -10) {
      alerts.push({
        id: 'REVENUE_DECLINING',
        severity: revenueGrowth < -30 ? 'CRITICAL' : 'WARNING',
        category: 'REVENUE',
        title: `Doanh thu giảm ${Math.abs(revenueGrowth)}% so với tháng trước`,
        message: `Tháng trước: ${dashboard.metrics.lastMonthRevenue.toLocaleString()}đ → Tháng này: ${dashboard.metrics.thisMonthRevenue.toLocaleString()}đ (${revenueGrowth}%).`,
        data: { revenueGrowth, thisMonth: dashboard.metrics.thisMonthRevenue, lastMonth: dashboard.metrics.lastMonthRevenue },
        actions: [
          { label: 'Tăng chiến dịch QC', type: 'NAVIGATE', target: '/ads-management' },
          { label: 'Xem phân tích leads', type: 'NAVIGATE', target: '/leads' },
          { label: 'Đẩy mạnh tuyển sinh', type: 'NAVIGATE', target: '/orders' },
        ],
      });
    }

    // Sort: CRITICAL → WARNING → INFO
    const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return {
      totalAlerts: alerts.length,
      criticalCount: alerts.filter(a => a.severity === 'CRITICAL').length,
      warningCount: alerts.filter(a => a.severity === 'WARNING').length,
      infoCount: alerts.filter(a => a.severity === 'INFO').length,
      marketingBudget: {
        fundBalance: marketingFundBalance,
        optimalDailyBudget: optimalAdsBudget,
        optimalMonthlyBudget,
        groupBreakdown: marketingBudgetNeeded.groupBreakdown,
      },
      alerts,
    };
  }

  /**
   * Tính ngân sách marketing tối ưu = tổng chi phí ads đề xuất tối ưu từ các nhóm QC
   * Dùng logarithmic curve fitting giống ads.service
   */
  private async calculateOptimalMarketingBudget(): Promise<{
    totalOptimalDailyBudget: number;
    groupBreakdown: any[];
  }> {
    // Get last 30 days of ad data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeGroups = await this.adGroupModel.find({ status: 'ACTIVE' }).lean();

    if (activeGroups.length === 0) {
      return { totalOptimalDailyBudget: 0, groupBreakdown: [] };
    }

    // Get daily spend & order data per group
    const [dailyData, dailyOrders] = await Promise.all([
      this.adCostModel.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { adGroupId: '$adGroupId', date: '$date' },
            spend: { $sum: '$spend' },
            adGroupName: { $first: '$adGroupName' },
            platform: { $first: '$platform' },
          },
        },
      ]),
      this.orderModel.aggregate([
        {
          $match: {
            adGroupId: { $exists: true, $ne: null },
            createdAt: { $gte: thirtyDaysAgo },
            status: { $in: ['APPROVED', 'COMPLETED'] },
          },
        },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            },
            orders: { $sum: 1 },
            revenue: { $sum: '$finalAmount' },
          },
        },
      ]),
    ]);

    const orderMap = new Map<string, Map<string, { orders: number; revenue: number }>>();
    for (const o of dailyOrders) {
      const gId = o._id.adGroupId.toString();
      if (!orderMap.has(gId)) orderMap.set(gId, new Map());
      orderMap.get(gId)!.set(o._id.date, { orders: o.orders, revenue: o.revenue });
    }

    // Build group data
    const groupData = new Map<string, {
      name: string; platform: string;
      points: Array<{ spend: number; orders: number; revenue: number }>;
    }>();

    for (const row of dailyData) {
      const gId = row._id.adGroupId.toString();
      if (!groupData.has(gId)) {
        groupData.set(gId, { name: row.adGroupName || '', platform: row.platform, points: [] });
      }
      const dateStr = row._id.date.toISOString().split('T')[0];
      const orderInfo = orderMap.get(gId)?.get(dateStr) || { orders: 0, revenue: 0 };
      groupData.get(gId)!.points.push({ spend: row.spend, orders: orderInfo.orders, revenue: orderInfo.revenue });
    }

    const groupBreakdown: any[] = [];
    let totalOptimal = 0;

    for (const [gId, data] of groupData) {
      const points = data.points;
      const currentAvgSpend = points.length > 0 ? points.reduce((s, p) => s + p.spend, 0) / points.length : 0;

      if (points.length < 7) {
        // Not enough data — use current average as suggestion
        groupBreakdown.push({
          adGroupId: gId,
          adGroupName: data.name,
          platform: data.platform,
          currentDailySpend: Math.round(currentAvgSpend),
          optimalDailySpend: Math.round(currentAvgSpend),
          confidence: 'LOW',
          reason: 'Chưa đủ dữ liệu (< 7 ngày)',
        });
        totalOptimal += Math.round(currentAvgSpend);
        continue;
      }

      // Fit logarithmic curve: orders = a * ln(spend + 1) + b
      const xValues = points.map(p => p.spend);
      const yOrders = points.map(p => p.orders);
      const yRevenue = points.map(p => p.revenue);

      const orderFit = this.fitLogCurveInternal(xValues, yOrders);
      const revFit = this.fitLogCurveInternal(xValues, yRevenue);

      // Find optimal: maximize (revenue - spend) → marginal revenue = 1
      // d(revenue)/d(spend) = revA / (spend + 1) = 1 → spend = revA - 1
      let optimalSpend = currentAvgSpend;

      if (revFit.a > 1) {
        optimalSpend = Math.max(0, revFit.a - 1);
      } else if (orderFit.a > 0) {
        // Fallback: use point where marginal orders drop below threshold
        optimalSpend = Math.max(currentAvgSpend, orderFit.a * 5);
      }

      // Cap at 3x current average to avoid extreme suggestions
      optimalSpend = Math.min(optimalSpend, currentAvgSpend * 3);
      optimalSpend = Math.max(optimalSpend, currentAvgSpend * 0.5); // Don't suggest less than half current

      const rounded = Math.round(optimalSpend / 10000) * 10000; // Round to 10K

      groupBreakdown.push({
        adGroupId: gId,
        adGroupName: data.name,
        platform: data.platform,
        currentDailySpend: Math.round(currentAvgSpend),
        optimalDailySpend: rounded,
        changePercent: currentAvgSpend > 0 ? Math.round(((rounded - currentAvgSpend) / currentAvgSpend) * 100) : 0,
        confidence: orderFit.rSquared >= 0.5 ? 'HIGH' : orderFit.rSquared >= 0.2 ? 'MEDIUM' : 'LOW',
        reason: rounded > currentAvgSpend
          ? 'Tăng ngân sách để tối ưu chuyển đổi'
          : rounded < currentAvgSpend
          ? 'Giảm ngân sách do hiệu quả biên giảm'
          : 'Giữ nguyên ngân sách hiện tại',
      });
      totalOptimal += rounded;
    }

    // Include active groups with no recent data
    for (const group of activeGroups) {
      const gId = (group as any)._id.toString();
      if (!groupData.has(gId)) {
        const dailyBudget = (group as any).dailyBudget || 0;
        groupBreakdown.push({
          adGroupId: gId,
          adGroupName: (group as any).name,
          platform: (group as any).platform,
          currentDailySpend: 0,
          optimalDailySpend: dailyBudget,
          confidence: 'LOW',
          reason: 'Chưa có dữ liệu chi phí — dùng budget đã cài đặt',
        });
        totalOptimal += dailyBudget;
      }
    }

    return { totalOptimalDailyBudget: totalOptimal, groupBreakdown };
  }

  private fitLogCurveInternal(xValues: number[], yValues: number[]): { a: number; b: number; rSquared: number } {
    const n = xValues.length;
    if (n < 2) return { a: 0, b: 0, rSquared: 0 };

    const X = xValues.map(x => Math.log(x + 1));
    const Y = yValues;

    const sumX = X.reduce((s, v) => s + v, 0);
    const sumY = Y.reduce((s, v) => s + v, 0);
    const sumXY = X.reduce((s, v, i) => s + v * Y[i], 0);
    const sumXX = X.reduce((s, v) => s + v * v, 0);

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-10) return { a: 0, b: sumY / n, rSquared: 0 };

    const a = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - a * sumX) / n;

    const meanY = sumY / n;
    const ssTotal = Y.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const ssResidual = Y.reduce((s, y, i) => s + (y - (a * X[i] + b)) ** 2, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    return { a, b, rSquared: Math.max(0, rSquared) };
  }

  // ════════════════════════════════════════════════════════════════════
  // AGING REPORT (Phase 1.4)
  // ════════════════════════════════════════════════════════════════════

  async getAgingReport() {
    const now = new Date();

    // Get wallets with negative balance (debt)
    const walletsWithDebt = await this.walletModel
      .find({ balance: { $lt: 0 } })
      .populate('userId', 'fullName email phone')
      .lean();

    // Get unpaid invoices (PENDING_APPROVAL or APPROVED but not yet fully consumed)
    const unpaidInvoices = await this.invoiceModel
      .find({ status: { $in: ['PENDING_APPROVAL'] } })
      .populate('studentId', 'fullName parentName parentPhone parentUserId')
      .lean();

    // Build aging buckets
    const agingMap: Map<string, {
      parentName: string;
      parentPhone: string;
      students: string[];
      totalDebt: number;
      oldestDate: Date;
      items: any[];
    }> = new Map();

    // Process wallet debts
    for (const w of walletsWithDebt) {
      const user = (w as any).userId;
      if (!user) continue;
      const key = user._id.toString();
      if (!agingMap.has(key)) {
        agingMap.set(key, {
          parentName: user.fullName || '',
          parentPhone: user.phone || '',
          students: [],
          totalDebt: 0,
          oldestDate: new Date(),
          items: [],
        });
      }
      const entry = agingMap.get(key)!;
      entry.totalDebt += Math.abs(w.balance);
      entry.items.push({ type: 'WALLET_DEBT', amount: Math.abs(w.balance), date: (w as any).updatedAt || now });
    }

    // Process unpaid invoices
    for (const inv of unpaidInvoices) {
      const student = (inv as any).studentId;
      if (!student) continue;
      const parentKey = student.parentUserId?.toString() || student.parentPhone || student._id.toString();
      if (!agingMap.has(parentKey)) {
        agingMap.set(parentKey, {
          parentName: student.parentName || '',
          parentPhone: student.parentPhone || '',
          students: [],
          totalDebt: 0,
          oldestDate: new Date(),
          items: [],
        });
      }
      const entry = agingMap.get(parentKey)!;
      entry.totalDebt += (inv as any).amount || 0;
      if (!entry.students.includes(student.fullName)) entry.students.push(student.fullName);
      const invDate = (inv as any).createdAt || now;
      if (invDate < entry.oldestDate) entry.oldestDate = invDate;
      entry.items.push({
        type: 'UNPAID_INVOICE',
        invoiceNumber: (inv as any).invoiceNumber,
        amount: (inv as any).amount,
        date: invDate,
        status: (inv as any).status,
      });
    }

    // Classify into aging buckets
    const getBucket = (date: Date): string => {
      const diffDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'current';
      if (diffDays <= 30) return '1-30';
      if (diffDays <= 60) return '31-60';
      if (diffDays <= 90) return '61-90';
      return '90+';
    };

    const results: any[] = [];
    const bucketSummary: Record<string, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

    for (const [, entry] of agingMap) {
      const bucket = getBucket(entry.oldestDate);
      bucketSummary[bucket] += entry.totalDebt;
      results.push({
        parentName: entry.parentName,
        parentPhone: entry.parentPhone,
        students: entry.students,
        totalDebt: entry.totalDebt,
        oldestDate: entry.oldestDate,
        bucket,
        items: entry.items,
      });
    }

    // Sort by totalDebt descending
    results.sort((a, b) => b.totalDebt - a.totalDebt);

    const totalAR = Object.values(bucketSummary).reduce((s, v) => s + v, 0);

    return {
      summary: { totalAR, ...bucketSummary },
      details: results,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // BANK RECONCILIATION (Phase 2.7)
  // ════════════════════════════════════════════════════════════════════

  async getReconciliation(bankAccountId: string, fromDate: string, toDate: string) {
    const dateFilter = {
      $gte: new Date(fromDate),
      $lte: new Date(toDate),
    };

    // Bank transactions
    const bankTxns = await this.bankTransactionModel.find({
      bankAccountId: new Types.ObjectId(bankAccountId),
      transactionDate: dateFilter,
    }).sort({ transactionDate: 1 }).lean();

    // Ledger entries (TOP_UP approved) in same period
    const ledgerEntries = await this.ledgerModel.find({
      type: 'TOP_UP',
      status: 'APPROVED',
      createdAt: dateFilter,
    }).lean();

    // Match by amount + date proximity (±1 day) + reference
    const matched: { bank: any; ledger: any }[] = [];
    const usedBankIds = new Set<string>();
    const usedLedgerIds = new Set<string>();

    for (const bank of bankTxns) {
      const bankDate = new Date((bank as any).transactionDate).getTime();
      const bankAmount = (bank as any).amount || 0;

      for (const ledger of ledgerEntries) {
        if (usedLedgerIds.has((ledger as any)._id.toString())) continue;

        const ledgerDate = new Date((ledger as any).createdAt).getTime();
        const ledgerAmount = (ledger as any).amount || 0;
        const dayDiff = Math.abs(bankDate - ledgerDate) / (1000 * 60 * 60 * 24);

        // Match criteria: same amount and within 1 day
        if (Math.abs(bankAmount - ledgerAmount) < 1 && dayDiff <= 1) {
          matched.push({ bank, ledger });
          usedBankIds.add((bank as any)._id.toString());
          usedLedgerIds.add((ledger as any)._id.toString());
          break;
        }
      }
    }

    const unmatchedBank = bankTxns.filter((b: any) => !usedBankIds.has(b._id.toString()));
    const unmatchedLedger = ledgerEntries.filter((l: any) => !usedLedgerIds.has(l._id.toString()));

    const matchedAmount = matched.reduce((s, m) => s + ((m.bank as any).amount || 0), 0);
    const unmatchedBankAmount = unmatchedBank.reduce((s, b: any) => s + (b.amount || 0), 0);
    const unmatchedLedgerAmount = unmatchedLedger.reduce((s, l: any) => s + (l.amount || 0), 0);

    return {
      matched: matched.map((m) => ({
        bankTxn: m.bank,
        ledgerEntry: m.ledger,
      })),
      unmatchedBank,
      unmatchedLedger,
      summary: {
        matchedCount: matched.length,
        matchedAmount,
        unmatchedBankCount: unmatchedBank.length,
        unmatchedBankAmount,
        unmatchedLedgerCount: unmatchedLedger.length,
        unmatchedLedgerAmount,
        variance: unmatchedBankAmount - unmatchedLedgerAmount,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // BALANCE SHEET (Phase 3.7)
  // ════════════════════════════════════════════════════════════════════

  async getBalanceSheet() {
    // Assets
    const bankAccounts = await this.bankAccountModel.find({ isActive: true }).lean();
    const totalBankBalance = bankAccounts.reduce((s, a: any) => s + (a.balance || 0), 0);

    const wallets = await this.walletModel.find({ status: 'ACTIVE' }).lean();
    const totalWalletBalance = wallets.reduce((s, w: any) => s + Math.max(w.balance || 0, 0), 0);
    const totalWalletReceivable = wallets.reduce((s, w: any) => s + Math.abs(Math.min(w.balance || 0, 0)), 0);

    const funds = await this.fundModel.find({ status: 'ACTIVE' }).lean();
    const totalFundBalance = funds.reduce((s, f: any) => s + (f.balance || 0), 0);

    const totalAssets = totalBankBalance + totalWalletBalance + totalFundBalance + totalWalletReceivable;

    // Liabilities
    const loansOutstanding = await this.loanModel2.find({ status: { $in: ['ACTIVE', 'OVERDUE'] } }).lean();
    const totalLoans = loansOutstanding.reduce((s, l: any) => s + ((l.amount || 0) - (l.paidAmount || 0)), 0);

    const pendingPayroll = await this.payrollModel.find({ status: { $in: ['PENDING', 'APPROVED'] } }).lean();
    const totalPendingPayroll = pendingPayroll.reduce((s, p: any) => s + (p.netAmount || 0), 0);

    const pendingExpenses = await this.expenseModel.find({ paymentStatus: { $in: ['PENDING', 'APPROVED'] } }).lean();
    const totalPendingExpenses = pendingExpenses.reduce((s, e: any) => s + (e.amount || 0), 0);

    const totalLiabilities = totalLoans + totalPendingPayroll + totalPendingExpenses;

    const equity = totalAssets - totalLiabilities;

    return {
      assets: {
        bankAccounts: bankAccounts.map((a: any) => ({ name: a.bankName, accountNumber: a.accountNumber, balance: a.balance })),
        totalBankBalance,
        totalWalletBalance,
        totalWalletReceivable,
        totalFundBalance,
        totalAssets,
      },
      liabilities: {
        totalLoans,
        loansCount: loansOutstanding.length,
        totalPendingPayroll,
        payrollCount: pendingPayroll.length,
        totalPendingExpenses,
        expensesCount: pendingExpenses.length,
        totalLiabilities,
      },
      equity,
      date: new Date().toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // TAX EXPORT (Phase 3.8)
  // ════════════════════════════════════════════════════════════════════

  async getTaxReport(year: number) {
    const months: any[] = [];

    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0, 23, 59, 59);
      const monthLabel = `${String(m + 1).padStart(2, '0')}/${year}`;

      // Revenue
      const invoices = await this.invoiceModel.find({
        status: 'APPROVED',
        approvedAt: { $gte: start, $lte: end },
      }).lean();
      const revenue = invoices.reduce((s, i: any) => s + (i.amount || 0), 0);

      // Expenses by category
      const expenses = await this.expenseModel.find({
        paymentStatus: 'PAID',
        paidAt: { $gte: start, $lte: end },
      }).lean();
      const totalExpenses = expenses.reduce((s, e: any) => s + (e.amount || 0), 0);
      const expenseByCategory: Record<string, number> = {};
      for (const exp of expenses) {
        const cat = (exp as any).category || 'OTHER';
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + ((exp as any).amount || 0);
      }

      // Payroll
      const payrolls = await this.payrollModel.find({
        status: 'PAID',
        paidAt: { $gte: start, $lte: end },
      }).lean();
      const totalPayroll = payrolls.reduce((s, p: any) => s + (p.netAmount || 0), 0);

      months.push({
        month: monthLabel,
        revenue,
        totalExpenses,
        expenseByCategory,
        totalPayroll,
        profit: revenue - totalExpenses - totalPayroll,
      });
    }

    const yearSummary = {
      totalRevenue: months.reduce((s, m) => s + m.revenue, 0),
      totalExpenses: months.reduce((s, m) => s + m.totalExpenses, 0),
      totalPayroll: months.reduce((s, m) => s + m.totalPayroll, 0),
      totalProfit: months.reduce((s, m) => s + m.profit, 0),
    };

    return { year, months, summary: yearSummary };
  }
}
