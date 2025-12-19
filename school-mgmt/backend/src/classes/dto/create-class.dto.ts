import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ClassType } from '../schemas/class.schema';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsArray()
  @IsOptional()
  teachers?: {
    teacherId: string;
    salary0?: number;
    salary1?: number;
    salary2?: number;
    salary3?: number;
    salary4?: number;
    salary5?: number;
    baseSalary70?: number;
    offlineSalary1?: number;
    offlineSalary2?: number;
    offlineSalary3?: number;
    offlineSalary4?: number;
  }[];

  @IsArray()
  @IsMongoId({ each: true })
  @ArrayUnique()
  @IsOptional()
  studentIds?: string[];

  @IsEnum(ClassType)
  @IsNotEmpty()
  classType!: ClassType;
}
