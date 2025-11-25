import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsMongoId()
  teacherId!: string;

  @IsMongoId()
  saleId!: string;

  @IsArray()
  @IsMongoId({ each: true })
  @ArrayUnique()
  @IsOptional()
  studentIds?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  revenuePerStudent?: number; // Doanh thu mỗi học sinh (VNĐ)

  @IsNumber()
  @Min(0)
  @IsOptional()
  teacherSalaryCost?: number; // Chi phí lương giáo viên mỗi học sinh (VNĐ)
}
