import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PaymentRequestsService } from './payment-requests.service';
import { SubmitPaymentRequestDto } from './dto/submit-payment-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

@Controller('payment-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentRequestsController {
  constructor(private readonly paymentRequestsService: PaymentRequestsService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.TEACHER)
  findAll() {
    return this.paymentRequestsService.findAll();
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.TEACHER)
  findOne(@Param('id') id: string) {
    return this.paymentRequestsService.findOne(id);
  }

  @Patch(':id/submit')
  @Roles(Role.DIRECTOR, Role.TEACHER)
  submitRequest(@Param('id') id: string, @Body() dto: SubmitPaymentRequestDto) {
    return this.paymentRequestsService.submitRequest(id, dto);
  }
}
