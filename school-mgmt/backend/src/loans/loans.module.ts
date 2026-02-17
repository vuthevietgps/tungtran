import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { Loan, LoanSchema } from './schemas/loan.schema';
import { LoanPayment, LoanPaymentSchema } from './schemas/loan-payment.schema';
import { FinancialControlModule } from '../financial-control/financial-control.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Loan.name, schema: LoanSchema },
      { name: LoanPayment.name, schema: LoanPaymentSchema },
    ]),
    FinancialControlModule,
  ],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
