import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean; // Ghi chú nội bộ (PH/GV không thấy)
}
