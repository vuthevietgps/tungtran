import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TicketPriority } from '../schemas/ticket.schema';

/** OPS/DIRECTOR cập nhật ticket */
export class UpdateTicketDto {
  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsMongoId()
  @IsOptional()
  assignedTo?: string;
}
