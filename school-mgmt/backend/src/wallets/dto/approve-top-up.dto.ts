import { IsOptional, IsString } from 'class-validator';

/**
 * ACCOUNTING duyệt hoặc từ chối yêu cầu nạp tiền.
 */
export class ApproveTopUpDto {
  @IsString()
  @IsOptional()
  accountingNotes?: string;
}
