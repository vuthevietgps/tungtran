import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceService } from './attendance.service';
import { AttendanceController, PublicAttendanceController } from './attendance.controller';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';
import { ClassesModule } from '../classes/classes.module';
import { StudentsModule } from '../students/students.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    ClassesModule,
    StudentsModule,
  ],
  controllers: [AttendanceController, PublicAttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService, MongooseModule],
})
export class AttendanceModule {}