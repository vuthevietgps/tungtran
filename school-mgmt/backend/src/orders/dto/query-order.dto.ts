import { IsOptional, IsString, IsEnum } from 'class-validator';
import { OrderStatus, OrderType } from '../schemas/order.schema';

export class QueryOrderDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: string;

  @IsEnum(OrderType)
  @IsOptional()
  orderType?: string;

  @IsString()
  @IsOptional()
  saleId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;
}
