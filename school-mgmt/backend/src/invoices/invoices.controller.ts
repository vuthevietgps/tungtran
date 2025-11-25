import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { UserDocument } from '../users/schemas/user.schema';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(Role.DIRECTOR, Role.SALE)
  create(@Body() createInvoiceDto: CreateInvoiceDto, @Req() req: Request) {
    return this.invoicesService.create(createInvoiceDto, req.user as any);
  }

  @Get()
  @Roles(Role.DIRECTOR, Role.SALE)
  findAll(@Req() req: Request) {
    return this.invoicesService.findAll(req.user as any);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get('student/:studentId')
  getInvoicesByStudent(@Param('studentId') studentId: string) {
    return this.invoicesService.getInvoicesByStudent(studentId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }

  @Post('receipt-upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Không có file được tải lên');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận file ảnh (JPG, PNG)');
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      throw new BadRequestException('File không được vượt quá 5MB');
    }

    // Return relative path for frontend
    const relativePath = `/uploads/invoices/${file.filename}`;
    return { url: relativePath };
  }
}