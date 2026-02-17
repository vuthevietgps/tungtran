import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinancialControlController } from './financial-control.controller';
import { FinancialControlService } from './financial-control.service';
import { BankAccount, BankAccountSchema } from './schemas/bank-account.schema';
import { BankTransaction, BankTransactionSchema } from './schemas/bank-transaction.schema';
import { Fund, FundSchema } from './schemas/fund.schema';
import { FundTransaction, FundTransactionSchema } from './schemas/fund-transaction.schema';

// Related schemas for cross-module aggregation
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { Payroll, PayrollSchema } from '../payroll/schemas/payroll.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { LedgerEntry, LedgerEntrySchema } from '../wallets/schemas/ledger-entry.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { AdCost, AdCostSchema } from '../ads/schemas/ad-cost.schema';
import { AdGroup, AdGroupSchema } from '../ads/schemas/ad-group.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Loan, LoanSchema } from '../loans/schemas/loan.schema';
import { LoanPayment, LoanPaymentSchema } from '../loans/schemas/loan-payment.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BankAccount.name, schema: BankAccountSchema },
      { name: BankTransaction.name, schema: BankTransactionSchema },
      { name: Fund.name, schema: FundSchema },
      { name: FundTransaction.name, schema: FundTransactionSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Payroll.name, schema: PayrollSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: AdCost.name, schema: AdCostSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Loan.name, schema: LoanSchema },
      { name: LoanPayment.name, schema: LoanPaymentSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [FinancialControlController],
  providers: [FinancialControlService],
  exports: [FinancialControlService],
})
export class FinancialControlModule {}
