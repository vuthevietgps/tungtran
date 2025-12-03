import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassroomStatusController } from './classroom-status.controller';
import { ClassroomStatusService } from './classroom-status.service';
import { ClassroomStatus, ClassroomStatusSchema } from './schemas/classroom-status.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClassroomStatus.name, schema: ClassroomStatusSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [ClassroomStatusController],
  providers: [ClassroomStatusService],
  exports: [ClassroomStatusService],
})
export class ClassroomStatusModule {}
