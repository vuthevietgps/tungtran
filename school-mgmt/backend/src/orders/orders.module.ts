import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { EnrollmentService } from './enrollment.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Classroom.name, schema: ClassroomSchema },
    ]),
    AuditLogModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, EnrollmentService],
  exports: [OrdersService, EnrollmentService],
})
export class OrdersModule {}
