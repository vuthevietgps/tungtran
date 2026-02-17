import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('stats')
  async getStats(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.expensesService.getStats(startDate, endDate);
  }

  @Post('process-recurring')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async processRecurring() {
    return this.expensesService.processRecurringExpenses();
  }

  @Get()
  async findAll(@Query() query: QueryExpenseDto) {
    return this.expensesService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Get(':id/children')
  async getChildren(@Param('id') id: string) {
    return this.expensesService.getRecurringChildren(id);
  }

  @Post()
  async create(@Body() dto: CreateExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.create(dto, req.user);
  }

  @Post(':id/upload-receipt')
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: diskStorage({
      destination: './uploads/expenses',
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `receipt-${unique}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf|webp)$/)) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ hỗ trợ file ảnh (jpg, png, gif, webp) hoặc PDF'), false);
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadReceipt(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthenticatedRequest,
  ) {
    const urls = files.map(f => `/uploads/expenses/${f.filename}`);
    return this.expensesService.uploadReceipt(id, urls, req.user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.update(id, dto, req.user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.expensesService.delete(id, req.user);
    return { message: 'Expense deleted successfully' };
  }

  @Post(':id/approve')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.expensesService.approve(id, req.user);
  }

  @Post(':id/reject')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async reject(@Param('id') id: string, @Body() dto: ApproveExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.reject(id, dto.rejectionReason || 'No reason provided', req.user);
  }

  @Post(':id/mark-paid')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async markPaid(@Param('id') id: string, @Body() dto: PayExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.markPaid(id, dto, req.user);
  }
}
