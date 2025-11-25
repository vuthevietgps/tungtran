import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { Classroom, ClassroomSchema } from './schemas/class.schema';
import { UsersModule } from '../users/users.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Classroom.name, schema: ClassroomSchema }]),
    UsersModule,
    StudentsModule,
  ],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService, MongooseModule],
})
export class ClassesModule {}
