import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payroll, PayrollDocument } from '../payroll/schemas/payroll.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { LedgerEntry, LedgerEntryDocument } from '../wallets/schemas/ledger-entry.schema';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';
import { buildDateFilter } from '../common/utils/date.utils';

@Injectable()
export class ExportService {
  constructor(
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    private auditLogService: AuditLogService,
  ) {}

  /** Export payroll data as CSV */
  async exportPayrollCsv(query: { fromDate?: string; toDate?: string; status?: string }, user: any): Promise<string> {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.fromDate || query.toDate) {
      filter.periodStart = {};
      if (query.fromDate) filter.periodStart.$gte = new Date(query.fromDate);
      if (query.toDate) filter.periodStart.$lte = new Date(query.toDate);
    }

    const data = await this.payrollModel
      .find(filter)
      .populate('teacherId', 'fullName email phone')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Mã lương,Giáo viên,Email,Kỳ bắt đầu,Kỳ kết thúc,Số buổi,Tổng brutto,Thưởng,Khấu trừ,Thực lĩnh,Trạng thái,Ngày tạo';
    const rows = data.map((p: any) => {
      const teacher = p.teacherId || {};
      return [
        p.payrollCode || '',
        teacher.fullName || '',
        teacher.email || '',
        p.periodStart ? new Date(p.periodStart).toLocaleDateString('vi-VN') : '',
        p.periodEnd ? new Date(p.periodEnd).toLocaleDateString('vi-VN') : '',
        p.totalSessions || 0,
        p.grossAmount || 0,
        p.bonusAmount || 0,
        p.deductionAmount || 0,
        p.netAmount || 0,
        p.status || '',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '',
      ].join(',');
    });

    await this.logExport(user, 'payroll', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /** Export invoices as CSV */
  async exportInvoicesCsv(query: { fromDate?: string; toDate?: string; status?: string }, user: any): Promise<string> {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const data = await this.invoiceModel
      .find(filter)
      .populate('studentId', 'fullName')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Số hóa đơn,Học sinh,Loại,Số tiền,Trạng thái,Người tạo,Ngày tạo';
    const rows = data.map((inv: any) => {
      return [
        inv.invoiceNumber || '',
        inv.studentId?.fullName || '',
        inv.type || '',
        inv.totalAmount || inv.amount || 0,
        inv.status || '',
        inv.createdBy?.fullName || '',
        inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('vi-VN') : '',
      ].join(',');
    });

    await this.logExport(user, 'invoices', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /** Export students as CSV */
  async exportStudentsCsv(user: any): Promise<string> {
    const data = await this.studentModel.find().sort({ fullName: 1 }).lean();

    const header = 'Họ tên,Ngày sinh,Giới tính,Lớp,Trường,Phụ huynh,SĐT PH,Trạng thái,Ngày tạo';
    const rows = data.map((s: any) => {
      return [
        s.fullName || '',
        s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('vi-VN') : '',
        s.gender || '',
        s.grade || '',
        s.school || '',
        s.parentName || '',
        s.parentPhone || '',
        s.status || 'ACTIVE',
        s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '',
      ].join(',');
    });

    await this.logExport(user, 'students', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /** Export financial summary (ledger) as CSV */
  async exportFinancialCsv(query: { fromDate?: string; toDate?: string }, user: any): Promise<string> {
    const filter: any = {};
    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const data = await this.ledgerModel
      .find(filter)
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Ngày,Loại GD,Trạng thái,Số tiền,SD trước,SD sau,Người dùng,Email,Mô tả,PT thanh toán';
    const rows = data.map((e: any) => {
      return [
        e.createdAt ? new Date(e.createdAt).toLocaleDateString('vi-VN') : '',
        e.type || '',
        e.status || '',
        e.amount || 0,
        e.balanceBefore || 0,
        e.balanceAfter || 0,
        e.userId?.fullName || '',
        e.userId?.email || '',
        (e.description || '').replace(/,/g, ';'),
        e.paymentMethod || '',
      ].join(',');
    });

    await this.logExport(user, 'financial', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /** Export attendance as CSV */
  async exportAttendanceCsv(query: { fromDate?: string; toDate?: string }, user: any): Promise<string> {
    const filter: any = {};
    const dateFilter = buildDateFilter(query.fromDate, query.toDate);
    if (dateFilter) filter.date = dateFilter;

    const data = await this.attendanceModel
      .find(filter)
      .populate('studentId', 'fullName')
      .populate('classId', 'name code')
      .sort({ date: -1 })
      .lean();

    const header = 'Ngày,Lớp,Học sinh,Trạng thái,Ghi chú';
    const rows = data.map((a: any) => {
      return [
        a.date ? new Date(a.date).toLocaleDateString('vi-VN') : '',
        a.classId?.name || '',
        a.studentId?.fullName || '',
        a.status || '',
        (a.notes || a.note || '').replace(/,/g, ';'),
      ].join(',');
    });

    await this.logExport(user, 'attendance', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  private async logExport(user: any, reportType: string, recordCount: number) {
    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.EXPORT,
      module: AuditModule.USERS,
      description: `Xuất báo cáo ${reportType} (${recordCount} bản ghi)`,
    });
  }
}
