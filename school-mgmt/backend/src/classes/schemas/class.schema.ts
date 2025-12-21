import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';

export enum ClassType {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export type ClassDocument = HydratedDocument<Classroom>;
export type ClassroomDocument = HydratedDocument<Classroom>;

@Schema({ timestamps: true })
export class Classroom {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, unique: true, uppercase: true })
  code!: string;

  @Prop({ 
    type: [{ 
      teacherId: { type: SchemaTypes.ObjectId, ref: User.name, required: true },
      salary0: { type: Number, min: 0, default: 0 },
      salary1: { type: Number, min: 0, default: 0 },
      salary2: { type: Number, min: 0, default: 0 },
      salary3: { type: Number, min: 0, default: 0 },
      salary4: { type: Number, min: 0, default: 0 },
      salary5: { type: Number, min: 0, default: 0 },
      offlineSalary1: { type: Number, min: 0, default: 0 },
      offlineSalary2: { type: Number, min: 0, default: 0 },
      offlineSalary3: { type: Number, min: 0, default: 0 },
      offlineSalary4: { type: Number, min: 0, default: 0 },
      canCreateAttendanceLink: { type: Boolean, default: false }
    }], 
    default: [],
    validate: {
      validator: function(v: any[]) {
        return v.length <= 10;
      },
      message: 'Không được phân công quá 10 giáo viên'
    }
  })
  teachers!: {
    teacherId: Types.ObjectId;
    salary0: number;
    salary1: number;
    salary2: number;
    salary3: number;
    salary4: number;
    salary5: number;
    offlineSalary1: number;
    offlineSalary2: number;
    offlineSalary3: number;
    offlineSalary4: number;
  }[];

  @Prop({ type: [SchemaTypes.ObjectId], ref: Student.name, default: [] })
  students!: Types.ObjectId[];

  @Prop({ type: String, enum: ClassType, required: true })
  classType!: ClassType;
}

export const ClassroomSchema = SchemaFactory.createForClass(Classroom);
