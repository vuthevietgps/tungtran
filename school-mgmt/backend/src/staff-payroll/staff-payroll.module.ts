import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffPayrollService } from './staff-payroll.service';
import { StaffPayrollController } from './staff-payroll.controller';
import { StaffPayroll, StaffPayrollSchema } from './schemas/staff-payroll.schema';
import { WorkSessionsModule } from '../work-sessions/work-sessions.module';
import { SalaryConfigModule } from '../salary-config/salary-config.module';
import { FinancialControlModule } from '../financial-control/financial-control.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StaffPayroll.name, schema: StaffPayrollSchema },
    ]),
    WorkSessionsModule,
    SalaryConfigModule,
    FinancialControlModule, // BUG #3 fix: ghi BankTransaction khi trả lương nhân viên
  ],
  controllers: [StaffPayrollController],
  providers: [StaffPayrollService],
  exports: [StaffPayrollService],
})
export class StaffPayrollModule {}
