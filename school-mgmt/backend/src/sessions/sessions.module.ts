import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session, SessionSchema } from './schemas/session.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
    forwardRef(() => WalletsModule),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService], // Export for Wallet/Payroll modules to use
})
export class SessionsModule {}
