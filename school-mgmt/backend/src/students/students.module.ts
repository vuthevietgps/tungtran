import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { Student, StudentSchema } from './schemas/student.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Student.name, schema: StudentSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService, MongooseModule],
})
export class StudentsModule {}
