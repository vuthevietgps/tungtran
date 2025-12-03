import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminSeeder } from './seed/admin.seeder';
import { ProductsModule } from './products/products.module';
import { StudentsModule } from './students/students.module';
import { ClassesModule } from './classes/classes.module';
import { AttendanceModule } from './attendance/attendance.module';
import { InvoicesModule } from './invoices/invoices.module';
import { OrdersModule } from './orders/orders.module';
import { ClassroomStatusModule } from './classroom-status/classroom-status.module';
import { PaymentRequestsModule } from './payment-requests/payment-requests.module';

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
    UsersModule,
    AuthModule,
    ProductsModule,
    StudentsModule,
    ClassesModule,
    AttendanceModule,
    InvoicesModule,
    OrdersModule,
    ClassroomStatusModule,
    PaymentRequestsModule,
  ],
  providers: [AdminSeeder],
})
export class AppModule {}