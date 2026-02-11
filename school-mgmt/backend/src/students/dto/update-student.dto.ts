import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStudentDto, PaymentFrameDto } from './create-student.dto';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @IsOptional()
  @IsString()
  studentCode?: string;

  // approvalStatus and approvedBy removed — system-managed only via approve() endpoint
}

export class UpdatePaymentsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentFrameDto)
  payments?: PaymentFrameDto[];
}
