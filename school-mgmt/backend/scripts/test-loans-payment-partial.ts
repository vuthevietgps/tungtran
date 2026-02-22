import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { Types } from 'mongoose';
import { LoansService } from '../src/loans/loans.service';
import { LoanPaymentStatus } from '../src/loans/schemas/loan-payment.schema';
import { LoanStatus } from '../src/loans/schemas/loan.schema';

async function main() {
  const loanId = new Types.ObjectId();
  const bankAccountId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const nowIso = new Date().toISOString();

  const payment: any = {
    loanId,
    paymentNumber: 1,
    totalAmount: 200,
    principalAmount: 150,
    interestAmount: 50,
    paidAmount: 0,
    paidPrincipal: 0,
    paidInterest: 0,
    status: LoanPaymentStatus.SCHEDULED,
    save: async () => payment,
  };

  const loan: any = {
    _id: loanId,
    loanCode: 'LOAN-001',
    lenderName: 'Test Lender',
    status: LoanStatus.ACTIVE,
    bankAccountId,
    totalPaid: 0,
    remainingBalance: 150,
    save: async () => loan,
  };

  const loanModel: any = {
    findOneAndUpdate: async (_filter: any, update: any) => {
      loan.totalPaid += update.$inc.totalPaid || 0;
      loan.remainingBalance += update.$inc.remainingBalance || 0;
      return loan;
    },
  };

  const paymentModel: any = {
    findOne: () => ({
      session: async () => payment,
    }),
    countDocuments: () => ({
      session: async () => (payment.status === LoanPaymentStatus.PAID ? 0 : 1),
    }),
  };

  const connection: any = {
    startSession: async () => ({
      startTransaction() {},
      commitTransaction: async () => {},
      abortTransaction: async () => {},
      endSession() {},
    }),
  };

  const bankCalls: any[] = [];
  const bankFundService: any = {
    recordBankTransaction: async (dto: any) => {
      bankCalls.push(dto);
      return {};
    },
  };

  const service = new LoansService(
    loanModel,
    paymentModel,
    connection,
    bankFundService,
  );

  const user = { _id: userId.toString(), fullName: 'Ops User' } as any;

  await service.recordPayment({
    loanId: loanId.toString(),
    paymentNumber: 1,
    paidDate: nowIso,
    amount: 50,
  } as any, user);

  assert.equal(payment.paidAmount, 50, 'Partial payment must increase cumulative paid amount');
  assert.equal(payment.paidInterest, 50, 'Partial payment must allocate to interest first');
  assert.equal(payment.paidPrincipal, 0, 'Partial payment must not reduce principal before interest is fully covered');
  assert.equal(payment.status, LoanPaymentStatus.PARTIAL, 'Installment must remain PARTIAL after underpayment');
  assert.equal(loan.remainingBalance, 150, 'Loan principal balance must not reduce when only interest is paid');
  assert.equal(bankCalls[0]?.amount, 50, 'Bank transaction amount must equal actual paid amount');

  await service.recordPayment({
    loanId: loanId.toString(),
    paymentNumber: 1,
    paidDate: nowIso,
    amount: 150,
  } as any, user);

  assert.equal(payment.paidAmount, 200, 'Second payment must close remaining outstanding amount');
  assert.equal(payment.paidInterest, 50, 'Interest paid must stay capped at installment interest');
  assert.equal(payment.paidPrincipal, 150, 'Second payment must reduce remaining principal');
  assert.equal(payment.status, LoanPaymentStatus.PAID, 'Installment must move to PAID when outstanding reaches zero');
  assert.equal(loan.remainingBalance, 0, 'Loan remaining balance must reach zero after full principal repayment');
  assert.equal(loan.status, LoanStatus.COMPLETED, 'Loan must move to COMPLETED when all installments are PAID');
  assert.equal(bankCalls[1]?.amount, 150, 'Second bank transaction must equal second paid amount');

  console.log('PASS: loans partial-payment allocation checks');
}

main().catch((err) => {
  console.error('FAIL: loans partial-payment allocation checks');
  console.error(err);
  process.exitCode = 1;
});

