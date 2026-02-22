import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LoansService } from '../src/loans/loans.service';
import { LoanStatus } from '../src/loans/schemas/loan.schema';

type SessionMock = {
  startTransaction: () => void;
  commitTransaction: () => Promise<void>;
  abortTransaction: () => Promise<void>;
  endSession: () => void;
};

const createSession = (): SessionMock => ({
  startTransaction() {},
  commitTransaction: async () => {},
  abortTransaction: async () => {},
  endSession() {},
});

async function testActivateDraftLoan() {
  const loanId = new Types.ObjectId();
  const bankAccountId = new Types.ObjectId();
  const user = { _id: new Types.ObjectId().toString(), fullName: 'Finance Ops' } as any;
  const startDate = new Date('2026-01-01T00:00:00.000Z');
  const principal = 100_000_000;

  const bankCalls: any[] = [];
  let createdPayments: any[] = [];

  const loanModel: any = {
    findOneAndUpdate: (filter: any, update: any) => ({
      exec: async () => {
        assert.equal(filter.status, LoanStatus.DRAFT, 'activate must update only DRAFT loans');
        return {
          _id: loanId,
          loanCode: 'LOAN-TEST',
          lenderName: 'Test Bank',
          principal,
          interestRate: 12,
          interestType: 'FIXED',
          term: 3,
          paymentFrequency: 'MONTHLY',
          startDate,
          bankAccountId,
          ...update.$set,
        };
      },
    }),
    findById: () => ({
      session: () => ({
        exec: async () => null,
      }),
    }),
  };

  const paymentModel: any = {
    deleteMany: () => ({
      session: async () => ({ deletedCount: 0 }),
    }),
    insertMany: async (docs: any[]) => {
      createdPayments = docs;
      return docs;
    },
  };

  const connection: any = {
    startSession: async () => createSession(),
  };

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

  const activated = await service.activate(loanId.toString(), user);
  assert.equal(activated.status, LoanStatus.ACTIVE, 'Loan must be ACTIVE after successful activation');
  assert.equal(createdPayments.length, 3, 'Activation must generate payment schedule');
  assert.equal(createdPayments[0].paymentCode, 'LP-LOAN-TEST-001', 'Payment code must be deterministic by loan + installment');
  assert.equal(createdPayments[2].paymentCode, 'LP-LOAN-TEST-003', 'Payment code sequence must be stable');
  assert.equal(bankCalls.length, 1, 'Activation must record one disbursement transaction');
  assert.equal(bankCalls[0].category, 'LOAN_DISBURSEMENT', 'Disbursement category must be LOAN_DISBURSEMENT');
  assert.equal(bankCalls[0].amount, principal, 'Disbursement amount must equal 100M principal');
}

async function testActivateNonDraftLoan() {
  const loanId = new Types.ObjectId();
  const user = { _id: new Types.ObjectId().toString(), fullName: 'Finance Ops' } as any;
  let bankCallCount = 0;
  let insertedPayments = 0;

  const loanModel: any = {
    findOneAndUpdate: () => ({
      exec: async () => null,
    }),
    findById: () => ({
      session: () => ({
        exec: async () => ({ _id: loanId, status: LoanStatus.ACTIVE }),
      }),
    }),
  };

  const paymentModel: any = {
    deleteMany: () => ({
      session: async () => ({ deletedCount: 0 }),
    }),
    insertMany: async () => {
      insertedPayments += 1;
      return [];
    },
  };

  const connection: any = {
    startSession: async () => createSession(),
  };

  const bankFundService: any = {
    recordBankTransaction: async () => {
      bankCallCount += 1;
      return {};
    },
  };

  const service = new LoansService(
    loanModel,
    paymentModel,
    connection,
    bankFundService,
  );

  let caught: any = null;
  try {
    await service.activate(loanId.toString(), user);
  } catch (err) {
    caught = err;
  }

  assert.ok(caught instanceof BadRequestException, 'activate must reject loans that are not DRAFT');
  assert.equal(bankCallCount, 0, 'No disbursement transaction must be created when activation is rejected');
  assert.equal(insertedPayments, 0, 'No payment schedule must be created when activation is rejected');
}

async function main() {
  await testActivateDraftLoan();
  await testActivateNonDraftLoan();
  console.log('PASS: loans activate status checks');
}

main().catch((err) => {
  console.error('FAIL: loans activate status checks');
  console.error(err);
  process.exitCode = 1;
});
