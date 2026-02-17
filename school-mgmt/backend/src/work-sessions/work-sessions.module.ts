import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkSessionsService } from './work-sessions.service';
import { WorkSessionsController } from './work-sessions.controller';
import { WorkSession, WorkSessionSchema } from './schemas/work-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkSession.name, schema: WorkSessionSchema },
    ]),
  ],
  controllers: [WorkSessionsController],
  providers: [WorkSessionsService],
  exports: [WorkSessionsService],
})
export class WorkSessionsModule {}
