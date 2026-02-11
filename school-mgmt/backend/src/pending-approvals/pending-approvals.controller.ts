import { Controller, Get, UseGuards } from '@nestjs/common';
import { PendingApprovalsService } from './pending-approvals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

@Controller('pending-approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PendingApprovalsController {
  constructor(private readonly service: PendingApprovalsService) {}

  @Get()
  @Roles(Role.DIRECTOR)
  getAll() {
    return this.service.getAll();
  }

  @Get('summary')
  @Roles(Role.DIRECTOR)
  getSummary() {
    return this.service.getSummary();
  }

  @Get('payrolls')
  @Roles(Role.DIRECTOR)
  getPendingPayrolls() {
    return this.service.getPendingPayrolls();
  }

  @Get('invoices')
  @Roles(Role.DIRECTOR)
  getPendingInvoices() {
    return this.service.getPendingInvoices();
  }

  @Get('topups')
  @Roles(Role.DIRECTOR)
  getPendingTopUps() {
    return this.service.getPendingTopUps();
  }

  @Get('teachers')
  @Roles(Role.DIRECTOR)
  getPendingTeachers() {
    return this.service.getPendingTeachers();
  }
}
