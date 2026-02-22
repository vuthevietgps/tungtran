import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { BankAccount, BankAccountDocument, BankAccountStatus } from './schemas/bank-account.schema';
import {
  BankTransaction,
  BankTransactionDocument,
  BankTransactionType,
} from './schemas/bank-transaction.schema';
import { Fund, FundDocument, FundStatus } from './schemas/fund.schema';
import {
  FundTransaction,
  FundTransactionDocument,
  FundTransactionType,
} from './schemas/fund-transaction.schema';
import {
  CreateBankAccountDto,
  QueryBankTransactionDto,
  RecordBankTransactionDto,
  UpdateBankAccountDto,
} from './dto/bank-account.dto';
import {
  CreateFundDto,
  FundTransactionDto,
  QueryFundTransactionDto,
  UpdateFundDto,
} from './dto/fund.dto';

@Injectable()
export class FinancialControlBankFundService {
  constructor(
    @InjectModel(BankAccount.name) private bankAccountModel: Model<BankAccountDocument>,
    @InjectModel(BankTransaction.name) private bankTransactionModel: Model<BankTransactionDocument>,
    @InjectModel(Fund.name) private fundModel: Model<FundDocument>,
    @InjectModel(FundTransaction.name) private fundTransactionModel: Model<FundTransactionDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  private toObjectId(id: string, fieldName: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return new Types.ObjectId(id);
  }

  private escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildCode(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}${timestamp}${suffix}`;
  }

  private async generateCode(
    model: Model<any>,
    prefix: string,
    session?: ClientSession,
  ): Promise<string> {
    const codeField = prefix.startsWith('BA-')
      ? 'accountCode'
      : prefix.startsWith('FUND-')
        ? 'fundCode'
        : 'transactionCode';
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.buildCode(prefix);
      const existsQuery = model.findOne({ [codeField]: code }).lean();
      if (session) {
        existsQuery.session(session);
      }
      const exists = await existsQuery;
      if (!exists) return code;
    }
    throw new BadRequestException('Unable to generate unique code');
  }

  async createBankAccount(dto: CreateBankAccountDto, user: JwtPayload): Promise<BankAccount> {
    const accountCode = await this.generateCode(this.bankAccountModel, 'BA-');
    const openingBalance = dto.openingBalance ?? 0;
    if (openingBalance < 0) {
      throw new BadRequestException('Số dư đầu kỳ không được âm');
    }

    if (dto.isPrimary) {
      await this.bankAccountModel.updateMany({}, { isPrimary: false });
    }

    const account = new this.bankAccountModel({
      ...dto,
      accountCode,
      currentBalance: openingBalance,
      openingBalance,
      createdById: user._id,
      createdByName: user.fullName,
    });

    return account.save();
  }

  async findAllBankAccounts(): Promise<BankAccount[]> {
    return this.bankAccountModel.find().sort({ isPrimary: -1, createdAt: -1 }).exec();
  }

  async findBankAccount(id: string): Promise<BankAccountDocument> {
    const accountId = this.toObjectId(id, 'bankAccountId');
    const account = await this.bankAccountModel.findById(accountId).exec();
    if (!account) throw new NotFoundException('Bank account not found');
    return account;
  }

  async updateBankAccount(id: string, dto: UpdateBankAccountDto): Promise<BankAccount> {
    const account = await this.findBankAccount(id);
    if (dto.isPrimary) {
      await this.bankAccountModel.updateMany({ _id: { $ne: account._id } }, { isPrimary: false });
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

  async recordBankTransaction(
    dto: RecordBankTransactionDto,
    user: JwtPayload,
    options?: { session?: ClientSession },
  ): Promise<BankTransaction> {
    if (options?.session) {
      return this.recordBankTransactionInSession(dto, user, options.session);
    }

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const transaction = await this.recordBankTransactionInSession(dto, user, session);

      await session.commitTransaction();
      return transaction;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  private async recordBankTransactionInSession(
    dto: RecordBankTransactionDto,
    user: JwtPayload,
    session: ClientSession,
  ): Promise<BankTransaction> {
    const bankAccountObjectId = this.toObjectId(dto.bankAccountId, 'bankAccountId');
    const referenceObjectId = dto.referenceId
      ? this.toObjectId(dto.referenceId, 'referenceId')
      : undefined;

    const isOutflow = [
      BankTransactionType.WITHDRAWAL,
      BankTransactionType.TRANSFER_OUT,
      BankTransactionType.FEE,
    ].includes(dto.type as BankTransactionType);

    let delta = dto.amount;
    if (isOutflow) delta = -dto.amount;

    const updateFilter: any = {
      _id: bankAccountObjectId,
      status: BankAccountStatus.ACTIVE,
    };
    if (delta < 0) {
      updateFilter.currentBalance = { $gte: Math.abs(delta) };
    }

    const account = await this.bankAccountModel.findOneAndUpdate(
      updateFilter,
      { $inc: { currentBalance: delta } },
      { new: false, session },
    ).exec();

    if (!account) {
      const existing = await this.bankAccountModel.findById(dto.bankAccountId).session(session).lean();
      if (!existing) throw new NotFoundException('Bank account not found');
      if (existing.status !== BankAccountStatus.ACTIVE) {
        throw new BadRequestException('Bank account is not active');
      }
      if (delta < 0 && existing.currentBalance < Math.abs(delta)) {
        throw new BadRequestException(
          `Số dư tài khoản ngân hàng không đủ. Hiện có: ${existing.currentBalance.toLocaleString()}đ`,
        );
      }
      throw new BadRequestException('Không thể ghi nhận giao dịch ngân hàng');
    }

    const balanceBefore = account.currentBalance;
    const balanceAfter = balanceBefore + delta;
    const transactionCode = await this.generateCode(this.bankTransactionModel, 'BT-', session);

    const [transaction] = await this.bankTransactionModel.create([{
      transactionCode,
      bankAccountId: bankAccountObjectId,
      type: dto.type,
      category: dto.category || 'OTHER',
      amount: Math.abs(dto.amount),
      balanceBefore,
      balanceAfter,
      transactionDate: new Date(dto.transactionDate),
      description: dto.description,
      reference: dto.reference,
      referenceId: referenceObjectId,
      referenceType: dto.referenceType,
      recordedById: user._id,
      recordedByName: user.fullName,
    }], { session });

    return transaction;
  }

  async findBankTransactions(query: QueryBankTransactionDto): Promise<BankTransaction[]> {
    const filter: any = {};
    if (query.bankAccountId) {
      filter.bankAccountId = this.toObjectId(query.bankAccountId, 'bankAccountId');
    }
    if (query.type) filter.type = query.type;
    if (query.category) filter.category = query.category;
    if (query.keyword?.trim()) {
      const keywordRegex = new RegExp(this.escapeRegex(query.keyword.trim()), 'i');
      filter.$or = [
        { transactionCode: keywordRegex },
        { description: keywordRegex },
        { reference: keywordRegex },
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
    const txId = this.toObjectId(id, 'transactionId');
    const tx = await this.bankTransactionModel.findById(txId).exec();
    if (!tx) throw new NotFoundException('Transaction not found');
    tx.isReconciled = true;
    tx.reconciledAt = new Date();
    tx.reconciledByName = user.fullName;
    return tx.save();
  }

  async createFund(dto: CreateFundDto, user: JwtPayload): Promise<Fund> {
    const fundCode = await this.generateCode(this.fundModel, 'FUND-');
    const openingBalance = dto.currentBalance ?? 0;
    if (openingBalance < 0) {
      throw new BadRequestException('Số dư quỹ ban đầu không được âm');
    }

    const fund = new this.fundModel({
      ...dto,
      fundCode,
      currentBalance: openingBalance,
      totalDeposited: openingBalance,
      createdById: user._id,
      createdByName: user.fullName,
    });

    return fund.save();
  }

  async findAllFunds(): Promise<Fund[]> {
    return this.fundModel.find().sort({ fundType: 1, createdAt: -1 }).exec();
  }

  async findFund(id: string): Promise<FundDocument> {
    const fundId = this.toObjectId(id, 'fundId');
    const fund = await this.fundModel.findById(fundId).exec();
    if (!fund) throw new NotFoundException('Fund not found');
    return fund;
  }

  async updateFund(id: string, dto: UpdateFundDto): Promise<Fund> {
    const fund = await this.findFund(id);
    Object.assign(fund, dto);
    return fund.save();
  }

  async recordFundTransaction(dto: FundTransactionDto, user: JwtPayload): Promise<FundTransaction> {
    const fundObjectId = this.toObjectId(dto.fundId, 'fundId');

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
          break;
        default:
          throw new BadRequestException('Invalid transaction type');
      }

      const updateFilter: any = {
        _id: fundObjectId,
        status: FundStatus.ACTIVE,
      };
      if (delta < 0) {
        updateFilter.currentBalance = { $gte: Math.abs(delta) };
      }

      const updatedFund = await this.fundModel.findOneAndUpdate(
        updateFilter,
        { $inc: incUpdate },
        { new: false, session },
      ).exec();

      if (!updatedFund) {
        const existingFund = await this.fundModel.findById(dto.fundId).session(session).lean();
        if (!existingFund) throw new NotFoundException('Fund not found');
        if (existingFund.status !== FundStatus.ACTIVE) {
          throw new BadRequestException('Quỹ không ở trạng thái hoạt động');
        }
        if (delta < 0 && existingFund.currentBalance < Math.abs(delta)) {
          throw new BadRequestException(
            `Số dư quỹ không đủ. Hiện có: ${existingFund.currentBalance.toLocaleString()}đ`,
          );
        }
        throw new BadRequestException('Không thể ghi nhận giao dịch quỹ');
      }

      const balanceBefore = updatedFund.currentBalance;
      const balanceAfter = balanceBefore + delta;
      const transactionCode = await this.generateCode(this.fundTransactionModel, 'FT-', session);

      const [transaction] = await this.fundTransactionModel.create([{
        transactionCode,
        fundId: fundObjectId,
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
    if (query.fundId) {
      filter.fundId = this.toObjectId(query.fundId, 'fundId');
    }
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
}
