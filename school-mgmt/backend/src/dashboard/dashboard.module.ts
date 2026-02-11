import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { LedgerEntry, LedgerEntrySchema } from '../wallets/schemas/ledger-entry.schema';
import { Payroll, PayrollSchema } from '../payroll/schemas/payroll.schema';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { TeacherProfile, TeacherProfileSchema } from '../teachers/schemas/teacher-profile.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: Payroll.name, schema: PayrollSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: User.name, schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Attendance.name, schema: AttendanceSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
