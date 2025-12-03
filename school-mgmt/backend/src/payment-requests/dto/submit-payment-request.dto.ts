import { IsNotEmpty, IsString } from 'class-validator';

export class SubmitPaymentRequestDto {
  @IsString()
  @IsNotEmpty()
  paymentStatus!: string;
}
