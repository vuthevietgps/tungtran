import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminSeeder } from './seed/admin.seeder';
import { ProductsModule } from './products/products.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { ClassesModule } from './classes/classes.module';
import { SessionsModule } from './sessions/sessions.module';
import { WalletsModule } from './wallets/wallets.module';
import { PayrollModule } from './payroll/payroll.module';
import { TicketsModule } from './tickets/tickets.module';
import { AttendanceModule } from './attendance/attendance.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TeachingMaterialsModule } from './teaching-materials/teaching-materials.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PendingApprovalsModule } from './pending-approvals/pending-approvals.module';
import { ExportModule } from './export/export.module';
import { LeadsModule } from './leads/leads.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://127.0.0.1:27017/school-mgmt'),
      }),
    }),
    AuditLogModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    StudentsModule,
    TeachersModule,
    ClassesModule,
    SessionsModule,
    WalletsModule,
    PayrollModule,
    TicketsModule,
    AttendanceModule,
    InvoicesModule,
    DashboardModule,
    TeachingMaterialsModule,
    PendingApprovalsModule,
    ExportModule,
    LeadsModule,
    OrdersModule,
  ],
  providers: [AdminSeeder],
})
export class AppModule {}