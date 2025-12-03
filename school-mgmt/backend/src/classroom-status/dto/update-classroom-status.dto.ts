import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClassroomStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  paymentStatus?: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class LockClassroomStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  isLocked!: boolean;
}
