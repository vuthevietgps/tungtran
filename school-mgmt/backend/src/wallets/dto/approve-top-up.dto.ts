import { IsBoolean, IsMongoId, IsOptional, IsString } from 'class-validator';

/**
 * ACCOUNTING duyệt hoặc từ chối yêu cầu nạp tiền.
 */
export class ApproveTopUpDto {
  @IsBoolean()
  @IsOptional()
  bankMatched?: boolean;

  @IsString()
  @IsOptional()
  bankStatementRef?: string;

  @IsString()
  @IsOptional()
  accountingNotes?: string;

  @IsMongoId()
  @IsOptional()
  bankAccountId?: string;
}
