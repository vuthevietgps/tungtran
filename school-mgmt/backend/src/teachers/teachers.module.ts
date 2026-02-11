import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';
import { TeacherProfile, TeacherProfileSchema } from './schemas/teacher-profile.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Payroll, PayrollSchema } from '../payroll/schemas/payroll.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Payroll.name, schema: PayrollSchema },
    ]),
  ],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
