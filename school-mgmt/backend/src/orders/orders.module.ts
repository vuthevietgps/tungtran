import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
