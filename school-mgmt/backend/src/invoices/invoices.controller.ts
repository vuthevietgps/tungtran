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
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { UserDocument } from '../users/schemas/user.schema';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { UpdatePaymentFrameDto } from './dto/update-payment-frame.dto';

const invoiceUploadPath = join(process.cwd(), 'uploads', 'invoices');
if (!existsSync(invoiceUploadPath)) {
  mkdirSync(invoiceUploadPath, { recursive: true });
}

const invoiceStorage = diskStorage({
  destination: invoiceUploadPath,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname) || '.jpg';
    cb(null, `receipt-${unique}${ext}`);
  },
});

const invoiceFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) return cb(null, true);
  return cb(new BadRequestException('Chỉ chấp nhận file ảnh (JPG, PNG)'), false);
};

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

  @Get('payments/all')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  getAllPaymentInvoices() {
    return this.invoicesService.getAllPaymentInvoices();
  }

  @Post('payments/:studentId/:frameIndex/confirm')
  @Roles(Role.DIRECTOR, Role.MANAGER)
  confirmPayment(
    @Param('studentId') studentId: string,
    @Param('frameIndex') frameIndex: string,
    @Body() body: { action: 'CONFIRM' | 'REJECT' }
  ) {
    return this.invoicesService.confirmPayment(studentId, parseInt(frameIndex), body.action);
  }

  @Patch('payments/:studentId/:frameIndex')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  updatePaymentFrame(
    @Param('studentId') studentId: string,
    @Param('frameIndex') frameIndex: string,
    @Body() dto: UpdatePaymentFrameDto,
  ) {
    return this.invoicesService.updatePaymentFrame(studentId, parseInt(frameIndex), dto);
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
  @UseInterceptors(FileInterceptor('file', {
    storage: invoiceStorage,
    fileFilter: invoiceFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadReceipt(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Không có file được tải lên');
    }

    // Return absolute URL so frontend stores usable path
    const protocol = req.protocol;
    const host = req.get('host');
    return { url: `${protocol}://${host}/uploads/invoices/${file.filename}` };
  }
}