import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsMongoId, IsIn } from 'class-validator';
import { CreateStudentDto } from './create-student.dto';
import { PaymentFrameDto } from './create-student.dto';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @IsOptional()
  @IsString()
  studentCode?: string;

  @IsOptional()
  @IsString()
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsMongoId()
  approvedBy?: string;

  @IsOptional()
  @IsIn(['Đang học', 'Bảo lưu', 'Đã dừng học'])
  dataStatus?: 'Đang học' | 'Bảo lưu' | 'Đã dừng học';
}

export class UpdatePaymentsDto {
  @IsOptional()
  payments?: PaymentFrameDto[];
}
