import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { AdAccount, AdAccountSchema } from './schemas/ad-account.schema';
import { AdGroup, AdGroupSchema } from './schemas/ad-group.schema';
import { ApiToken, ApiTokenSchema } from './schemas/api-token.schema';
import { AdCost, AdCostSchema } from './schemas/ad-cost.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: ApiToken.name, schema: ApiTokenSchema },
      { name: AdCost.name, schema: AdCostSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
