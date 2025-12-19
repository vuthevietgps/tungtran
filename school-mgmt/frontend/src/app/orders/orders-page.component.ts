import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderItem, OrderPayload, OrderService, OrderSessionEntry } from '../services/order.service';
import { UserItem, UserService } from '../services/user.service';
import { ClassItem, ClassService } from '../services/class.service';
import { StudentItem, StudentService } from '../services/student.service';
import { environment } from '../../environments/environment';

interface ClassTeacherView {
  _id: string;
  fullName: string;
  email?: string;
  salary0?: number;
}

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders-page.component.html',
  styleUrls: ['./orders-page.component.css'],
})
export class OrdersPageComponent {
  private readonly NEW_ID = '__new__';
  teachers = signal<UserItem[]>([]);
  sales = signal<UserItem[]>([]);
  classes = signal<ClassItem[]>([]);
  students = signal<StudentItem[]>([]);
  orders = signal<OrderItem[]>([]);
  selectedStudentData = signal<any>(null);
  classTeachers = signal<ClassTeacherView[]>([]);
  keyword = signal('');
  teacherFilter = signal('');
  classFilter = signal('');
  studentTypeFilter = signal('');
  saleFilter = signal('');
  birthMonthFilter = signal('');
  error = signal('');
  sessionColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  readonly sessionDisplayDurations = [40, 50, 70, 90, 110, 120];
  form: OrderFormState = this.blankForm();
  editingId: string | null = null;

  availableInvoices = computed(() => {
    const studentData = this.selectedStudentData();
    if (!studentData || !studentData.payments) return [];
    return studentData.payments
      .filter((p: any) => {
        const status = (p.confirmStatus || '').toUpperCase();
        return p.invoiceCode && (status === 'CONFIRMED' || status === 'APPROVED');
      })
      .map((p: any) => ({
        code: p.invoiceCode,
        sessions: p.sessionsCollected ?? p.sessionsRegistered ?? 0,
      }));
  });

  filtered = computed(() => {
    const kw = this.keyword().trim().toLowerCase();
    const teacherFilter = this.teacherFilter();
    const classFilter = this.classFilter();
    const studentTypeFilter = this.studentTypeFilter();
    const saleFilter = this.saleFilter();
    const birthMonthFilter = this.birthMonthFilter();
    return this.orders()
      .filter((order: OrderItem) => {
        if (teacherFilter && order.teacherId !== teacherFilter) return false;
        if (classFilter && order.classId !== classFilter) return false;
        if (studentTypeFilter) {
          const derivedType = order.studentType || this.studentOrForm(order)?.studentType || '';
          if (derivedType !== studentTypeFilter) return false;
        }
        if (saleFilter) {
          const saleId = this.saleIdOf(order);
          if (saleId !== saleFilter) return false;
        }
        if (birthMonthFilter) {
          const month = this.studentBirthMonth(order);
          if (month === null || String(month) !== birthMonthFilter) return false;
        }
        if (!kw) return true;
        return (
          order.studentName.toLowerCase().includes(kw) ||
          order.studentCode.toLowerCase().includes(kw) ||
          (order.parentName || '').toLowerCase().includes(kw) ||
          (order.saleName || '').toLowerCase().includes(kw)
        );
      })
      .sort((a: OrderItem, b: OrderItem) => {
        const codeCompare = a.studentCode.localeCompare(b.studentCode);
        if (codeCompare !== 0) return codeCompare;
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  });

  constructor(
    private orderService: OrderService,
    private userService: UserService,
    private classService: ClassService,
    private studentService: StudentService,
  ) {
    this.loadReferenceData();
    this.reload();
  }

  async loadReferenceData() {
    const [teachers, sales, classes, students] = await Promise.all([
      this.userService.listTeachers(),
      this.userService.listSales(),
      this.classService.list(),
      this.studentService.list(),
    ]);
    this.teachers.set(teachers);
    this.sales.set(sales);
    this.classes.set(classes);
    this.students.set(students);
  }

  async reload() {
    const data = await this.orderService.list();
    const withDemo = environment.production
      ? data
      : [...data.filter((o) => o._id !== '__demo_100__'), this.demoOrder100()];
    this.orders.set(withDemo);
  }

  resetFilters() {
    this.keyword.set('');
    this.teacherFilter.set('');
    this.classFilter.set('');
    this.studentTypeFilter.set('');
    this.saleFilter.set('');
    this.birthMonthFilter.set('');
  }

  startCreate() {
    if (this.isEditing()) return;
    this.editingId = this.NEW_ID;
    this.form = this.blankForm();
    this.error.set('');
  }

  startEdit(order: OrderItem) {
    if (this.isEditing()) return;
    this.editingId = order._id;
    this.form = {
      studentName: order.studentName,
      studentCode: order.studentCode,
      studentType: order.studentType || '',
      level: order.level || '',
      parentName: order.parentName,
      teacherId: order.teacherId || '',
      teacherName: order.teacherName || '',
      teacherEmail: order.teacherEmail || '',
      teacherCode: order.teacherCode || '',
      teacherSalary: order.teacherSalary != null ? String(order.teacherSalary) : '',
      saleId: order.saleId || '',
      saleName: order.saleName || '',
      saleEmail: order.saleEmail || '',
      classId: order.classId || '',
      classCode: order.classCode || '',
      invoiceNumber: order.invoiceNumber || '',
      sessionsByInvoice: order.sessionsByInvoice != null ? String(order.sessionsByInvoice) : '',
      expectedSessions: order.expectedSessions != null ? String(order.expectedSessions) : '',
      sessionDuration: order.sessionDuration != null ? String(order.sessionDuration) : '',
      dataStatus: order.dataStatus || '',
      trialOrGift: order.trialOrGift || '',
      status: order.status || 'Đang hoạt động',
    };

    const classroom = this.classByIdOrCode(order.classId, order.classCode);
    if (classroom) {
      this.applyClassTeachers(classroom, false);
    }

    this.error.set('');
  }

  cancel() {
    this.editingId = null;
    this.form = this.blankForm();
    this.error.set('');
  }

  async remove(order: OrderItem) {
    if (this.isEditing()) return;
    if (!confirm(`Xóa đơn hàng của học sinh ${order.studentName}?`)) return;
    const result = await this.orderService.remove(order._id);
    if (!result.ok) {
      alert(result.message || 'Không thể xóa đơn hàng');
      return;
    }
    await this.reload();
  }

  async save() {
    if (!this.editingId) return;
    const payload: OrderPayload = {
      studentName: this.form.studentName.trim(),
      studentCode: this.form.studentCode.trim(),
      level: this.form.level.trim() || undefined,
      parentName: this.form.parentName.trim(),
      teacherId: this.form.teacherId || undefined,
      teacherName: this.form.teacherName.trim() || undefined,
      teacherEmail: this.form.teacherEmail.trim() || undefined,
      teacherCode: this.form.teacherCode.trim() || undefined,
      teacherSalary: this.form.teacherSalary ? Number(this.form.teacherSalary) : undefined,
      saleId: this.form.saleId || undefined,
      saleName: this.form.saleName.trim() || undefined,
      saleEmail: this.form.saleEmail.trim() || undefined,
      classId: this.form.classId || undefined,
      classCode: this.form.classCode.trim() || undefined,
      invoiceNumber: this.form.invoiceNumber.trim() || undefined,
      sessionsByInvoice: this.form.sessionsByInvoice ? Number(this.form.sessionsByInvoice) : undefined,
      expectedSessions: this.form.expectedSessions ? Number(this.form.expectedSessions) : undefined,
      sessionDuration: this.form.sessionDuration ? Number(this.form.sessionDuration) : undefined,
      dataStatus: this.form.dataStatus.trim() || undefined,
      trialOrGift: this.form.trialOrGift.trim() || undefined,
      status: this.form.status.trim() || 'Đang hoạt động',
    };

    if (!payload.studentName || !payload.studentCode || !payload.parentName) {
      this.error.set('Vui lòng nhập tên học sinh, mã học sinh và tên phụ huynh.');
      return;
    }

    const isCreate = this.isCreating();
    const result = isCreate
      ? await this.orderService.create(payload)
      : await this.orderService.update(this.editingId, payload);

    if (!result.ok) {
      this.error.set(result.message || 'Không thể lưu đơn hàng');
      return;
    }

    await this.reload();
    this.cancel();
  }

  handleTeacherChange(teacherId: string) {
    if (!teacherId) {
      this.form.teacherName = '';
      this.form.teacherEmail = '';
      this.form.teacherCode = '';
      return;
    }

    const classTeacher = this.classTeachers().find((t) => t._id === teacherId);
    if (classTeacher) {
      this.form.teacherName = classTeacher.fullName;
      this.form.teacherEmail = classTeacher.email || '';
      this.form.teacherCode = this.teacherCodeFromEmail(classTeacher.email);
      if (classTeacher.salary0 != null) this.form.teacherSalary = String(classTeacher.salary0);
      return;
    }

    const teacher = this.teachers().find((t) => t._id === teacherId);
    if (!teacher) return;
    this.form.teacherName = teacher.fullName;
    this.form.teacherEmail = teacher.email;
    this.form.teacherCode = this.teacherCodeFromEmail(teacher.email);
  }

  async handleStudentCodeChange(studentCode: string) {
    if (!studentCode) {
      this.form.studentName = '';
      this.form.studentType = '';
      this.form.parentName = '';
      this.form.level = '';
      this.form.saleId = '';
      this.form.saleName = '';
      this.form.saleEmail = '';
      this.form.invoiceNumber = '';
      this.form.sessionsByInvoice = '';
      this.selectedStudentData.set(null);
      return;
    }

    const student = this.students().find((s) => s.studentCode === studentCode);
    if (!student) return;

    const res = await fetch(`${environment.apiBase}/students/${student._id}`, {
      headers: { Authorization: `Bearer ${this.studentService['auth'].getToken()}` },
    });

    if (res.ok) {
      const fullStudent = await res.json();
      this.selectedStudentData.set(fullStudent);
      this.form.studentName = fullStudent.fullName || '';
      this.form.studentType = fullStudent.studentType || '';
      this.form.parentName = fullStudent.parentName || '';
      this.form.level = fullStudent.productPackage?.name || this.form.level || '';

      if (fullStudent.saleId) {
        const sale = this.sales().find((s) => s._id === fullStudent.saleId);
        if (sale) {
          this.form.saleId = sale._id;
          this.form.saleName = sale.fullName;
          this.form.saleEmail = sale.email;
        }
      } else if (fullStudent.saleName) {
        this.form.saleName = fullStudent.saleName;
        this.form.saleEmail = '';
      }

      this.form.invoiceNumber = '';
      this.form.sessionsByInvoice = '';
    }
  }

  handleInvoiceChange(invoiceCode: string) {
    if (!invoiceCode) {
      this.form.sessionsByInvoice = '';
      return;
    }

    const invoice = this.availableInvoices().find((inv: any) => inv.code === invoiceCode);
    if (invoice) {
      this.form.sessionsByInvoice = String(invoice.sessions);
    }
  }

  handleSaleChange(saleId: string) {
    if (!saleId) {
      this.form.saleName = '';
      this.form.saleEmail = '';
      return;
    }
    const sale = this.sales().find((s) => s._id === saleId);
    if (!sale) return;
    this.form.saleName = sale.fullName;
    this.form.saleEmail = sale.email;
  }

  async handleClassChange(classId: string) {
    this.form.teacherId = '';
    this.form.teacherName = '';
    this.form.teacherEmail = '';
    this.form.teacherCode = '';
    this.form.teacherSalary = '';
    this.classTeachers.set([]);

    if (!classId) {
      this.form.classCode = '';
      return;
    }

    const classroom = this.classes().find((c) => c._id === classId);
    if (!classroom) return;

    this.form.classCode = classroom.code;
    this.applyClassTeachers(classroom);
  }

  handleClassCodeChange(classCode: string) {
    if (!classCode) {
      this.form.classId = '';
      this.classTeachers.set([]);
      this.form.teacherId = '';
      this.form.teacherName = '';
      this.form.teacherEmail = '';
      this.form.teacherCode = '';
      this.form.teacherSalary = '';
      return;
    }

    const existingClass = this.classes().find((c) => c.code.toLowerCase() === classCode.toLowerCase());

    if (existingClass) {
      this.form.classId = existingClass._id;
      this.applyClassTeachers(existingClass);
    } else {
      this.form.classId = '';
      this.classTeachers.set([]);
      this.form.teacherId = '';
      this.form.teacherName = '';
      this.form.teacherEmail = '';
      this.form.teacherCode = '';
      this.form.teacherSalary = '';
    }
  }

  sessionCell(order: OrderItem | null, sessionIndex: number): OrderSessionEntry | null {
    if (!order) return null;
    return order.sessions.find((s) => s.sessionIndex === sessionIndex) || null;
  }

  attendedSessions(order?: OrderItem): OrderSessionEntry[] {
    if (!order) return [];
    return (order.sessions || []).filter((s) => !!s.attendedAt);
  }

  generateAttendanceCode(studentCode?: string, teacherCode?: string, sessionDate?: string, sessionIndex?: number): string {
    if (!studentCode || !teacherCode || !sessionDate) return '-';

    const date = new Date(sessionDate);
    if (Number.isNaN(date.getTime())) return '-';

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthAbbr = monthNames[date.getMonth()];

    return `${studentCode}${teacherCode}${monthAbbr}${sessionIndex || ''}`;
  }

  formatDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('vi-VN');
  }

  formatDateTime(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN');
  }

  imageUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = environment.apiBase.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  private studentByCode(code?: string): StudentItem | undefined {
    const normalized = (code || '').trim();
    if (!normalized) return undefined;
    return this.students().find((s) => s.studentCode === normalized);
  }

  private classByIdOrCode(classId?: string, classCode?: string): ClassItem | undefined {
    if (classId) {
      const found = this.classes().find((c) => c._id === classId);
      if (found) return found;
    }
    const code = (classCode || '').trim().toUpperCase();
    if (!code) return undefined;
    return this.classes().find((c) => c.code.toUpperCase() === code);
  }

  private classTeacherEntries(classId?: string, classCode?: string): ClassTeacherView[] {
    const classroom = this.classByIdOrCode(classId, classCode);
    if (!classroom?.teachers?.length) return [];
    return classroom.teachers.map((t) => ({
      _id: (t.teacherId as any)?._id || (t.teacherId as any) || '',
      fullName: (t.teacherId as any)?.fullName || '',
      email: (t.teacherId as any)?.email,
      salary0: (t as any)?.salary0,
    }));
  }

  private applyClassTeachers(classroom?: ClassItem, applyPrimary = true) {
    const entries = classroom ? this.classTeacherEntries(classroom._id, classroom.code) : [];
    this.classTeachers.set(entries);
    const primary = entries[0];
    if (primary && applyPrimary) {
      this.form.teacherId = primary._id;
      this.form.teacherName = primary.fullName;
      this.form.teacherEmail = primary.email || '';
      this.form.teacherCode = this.teacherCodeFromEmail(primary.email);
      if (primary.salary0 != null) this.form.teacherSalary = String(primary.salary0);
    }
  }

  private teacherCodeFromEmail(email?: string): string {
    if (!email) return '';
    const [prefix] = email.split('@');
    return prefix || email;
  }

  private studentOrForm(order?: OrderItem): StudentItem | undefined {
    const code = order?.studentCode || this.form.studentCode;
    return this.studentByCode(code);
  }

  private studentBirthMonth(order?: OrderItem): number | null {
    const dob = this.studentOrForm(order)?.dateOfBirth;
    if (!dob) return null;
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return null;
    return date.getMonth() + 1;
  }

  private saleIdOf(order?: OrderItem): string {
    return order?.saleId || this.studentOrForm(order)?.saleId || '';
  }

  studentPhone(order?: OrderItem): string {
    return this.studentOrForm(order)?.parentPhone || '-';
  }

  studentLevel(order?: OrderItem): string {
    const student = this.studentOrForm(order);
    return order?.level || student?.productPackage?.name || '';
  }

  studentTypeLabel(order?: OrderItem): string {
    const t = order?.studentType || this.studentOrForm(order)?.studentType;
    if (t === 'OFFLINE') return 'Offline';
    if (t === 'ONLINE') return 'Online';
    return '-';
  }

  studentDob(order?: OrderItem): string {
    const dob = this.studentOrForm(order)?.dateOfBirth;
    if (!dob) return '-';
    const date = new Date(dob);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('vi-VN');
  }

  studentAge(order?: OrderItem): string {
    const age = this.studentOrForm(order)?.age;
    return age != null ? String(age) : '-';
  }

  studentSale(order?: OrderItem): string {
    return this.studentOrForm(order)?.saleName || '';
  }

  className(order?: OrderItem, classCodeOverride?: string, classIdOverride?: string): string {
    const classroom = this.classByIdOrCode(classIdOverride || order?.classId, classCodeOverride || order?.classCode);
    return classroom?.name || '-';
  }

  formatTeacherCodes(order?: OrderItem, classCodeOverride?: string, classIdOverride?: string): string {
    const entries = this.classTeacherEntries(classIdOverride || order?.classId, classCodeOverride || order?.classCode);
    const codes = entries
      .map((t) => this.teacherCodeFromEmail(t.email) || t._id)
      .filter(Boolean);
    return codes.length ? codes.join(', ') : '-';
  }

  formatTeacherNameSalary(order?: OrderItem, classCodeOverride?: string, classIdOverride?: string): string {
    const entries = this.classTeacherEntries(classIdOverride || order?.classId, classCodeOverride || order?.classCode);
    const parts = entries.map((t) => {
      const salary = t.salary0 != null ? t.salary0 : undefined;
      return `${t.fullName || 'GV'}${salary != null ? ` (${salary})` : ''}`;
    });
    return parts.length ? parts.join('; ') : '-';
  }

  sessionBalanceLines(order?: OrderItem): Array<{ text: string; highlight: boolean }> {
    const student = this.studentOrForm(order);
    const b = student?.sessionBalances as any;
    const fmt = (val: number) => (Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/\.00$/, ''));
    const type = order?.studentType || student?.studentType || '';
    const highlights = this.registeredDurations(order);

    if (type === 'OFFLINE') {
      const paid = Number.isFinite(b?.basePaid70) ? Number(b.basePaid70) : 0;
      const used = Number.isFinite(b?.baseUsed70) ? Number(b.baseUsed70) : 0;
      const remaining = Math.max(0, paid - used);
      return [{ text: `${fmt(remaining)} buổi (đã thu ${fmt(paid)}, đã điểm danh ${fmt(used)})`, highlight: false }];
    }

    if (!b) return [{ text: '—', highlight: false }];
    const paid70 = Number.isFinite(b.basePaid70) ? Number(b.basePaid70) : 0;
    const used70 = Number.isFinite(b.baseUsed70) ? Number(b.baseUsed70) : 0;
    const remainingMinutes = Math.max(0, (paid70 - used70) * 70);

    return this.sessionDisplayDurations.map((dur) => {
      const paid = Math.floor((paid70 * 70) / dur);
      const used = Math.floor((used70 * 70) / dur);
      const remaining = Math.max(0, Math.floor(remainingMinutes / dur));
      return {
        text: `${dur}p: thu ${fmt(paid)} | đã DD ${fmt(used)} | còn ${fmt(remaining)}`,
        highlight: highlights.has(dur),
      };
    });
  }

  private registeredDurations(order?: OrderItem): Set<number> {
    const student = this.studentOrForm(order) as any;
    const payments = (student?.payments as any[]) || [];
    const allowed = new Set(this.sessionDisplayDurations);
    const set = new Set<number>();
    payments.forEach((p) => {
      const dur = Number((p as any)?.sessionDuration);
      if (allowed.has(dur)) set.add(dur);
    });
    const orderDuration = Number(order?.sessionDuration);
    if (allowed.has(orderDuration)) set.add(orderDuration);
    return set;
  }

  sessionChunks(order?: OrderItem | null): Array<{ start: number; end: number }> {
    const chunkSize = this.sessionColumns.length;
    const sessions = order?.sessions || [];
    const maxFromData = sessions.reduce((max, s) => (s.sessionIndex && s.sessionIndex > max ? s.sessionIndex : max), 0);
    const maxIndex = Math.max(maxFromData || chunkSize, chunkSize);

    const chunks: Array<{ start: number; end: number }> = [];
    for (let start = 1; start <= maxIndex; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, maxIndex);
      chunks.push({ start, end });
    }
    return chunks.length ? chunks : [{ start: 1, end: chunkSize }];
  }

  studentStatus(order?: OrderItem): string {
    return order?.dataStatus || this.form.dataStatus || 'Đang học';
  }

  isEditing(id?: string): boolean {
    if (!this.editingId) return false;
    if (!id) return true;
    return this.editingId === id;
  }

  isCreating(): boolean {
    return this.editingId === this.NEW_ID;
  }

  private blankForm(): OrderFormState {
    return {
      studentName: '',
      studentCode: '',
      studentType: '',
      level: '',
      parentName: '',
      teacherId: '',
      teacherName: '',
      teacherEmail: '',
      teacherCode: '',
      teacherSalary: '',
      saleId: '',
      saleName: '',
      saleEmail: '',
      classId: '',
      classCode: '',
      invoiceNumber: '',
      sessionsByInvoice: '',
      expectedSessions: '',
      sessionDuration: '',
      dataStatus: '',
      trialOrGift: '',
      status: 'Đang hoạt động',
    };
  }

  private demoOrder100(): OrderItem {
    const base = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const sessions: OrderSessionEntry[] = Array.from({ length: 100 }, (_, i) => {
      const idx = i + 1;
      const date = new Date(base);
      date.setUTCDate(base.getUTCDate() + i);
      const iso = date.toISOString();
      const attended = idx <= 60;
      return {
        sessionIndex: idx,
        date: iso,
        classCode: 'DEMO100',
        studentCode: 'DEMO100',
        classId: 'demo-class',
        teacherCode: 'GV100',
        teacherEmail: 'gv100@example.com',
        lookupUrl: '#',
        attendanceId: `demo-${idx}`,
        attendedAt: attended ? iso : undefined,
        imageUrl: attended && idx % 5 === 0 ? 'https://via.placeholder.com/64' : undefined,
        sessionDuration: 70,
        salaryAmount: 0,
        status: attended ? 'PRESENT' : undefined,
      };
    });

    return {
      _id: '__demo_100__',
      studentId: 'demo-student',
      studentName: 'Demo 100 buổi',
      studentCode: 'DEMO100',
      studentType: 'ONLINE',
      level: 'A1',
      parentName: 'Phụ huynh demo',
      teacherId: 'demo-teacher',
      teacherName: 'GV Demo',
      teacherEmail: 'gv100@example.com',
      teacherCode: 'GV100',
      teacherSalary: 0,
      saleId: undefined,
      saleName: 'Sale Demo',
      saleEmail: 'sale@example.com',
      classId: 'demo-class',
      classCode: 'DEMO100',
      invoiceNumber: 'INV-DEMO100',
      sessionsByInvoice: 100,
      expectedSessions: 100,
      sessionDuration: 70,
      dataStatus: 'Đang học',
      trialOrGift: '',
      totalAttendedSessions: 60,
      teacherEarnedSalary: 0,
      paymentStatus: 'PAID',
      paymentInvoiceCode: 'PAY-DEMO100',
      paymentProofImage: undefined,
      status: 'Đang hoạt động',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessions,
    };
  }
}

interface OrderFormState {
  studentName: string;
  studentCode: string;
  studentType: 'ONLINE' | 'OFFLINE' | '';
  level: string;
  parentName: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherCode: string;
  teacherSalary: string;
  saleId: string;
  saleName: string;
  saleEmail: string;
  classId: string;
  classCode: string;
  invoiceNumber: string;
  sessionsByInvoice: string;
  expectedSessions: string;
  sessionDuration: string;
  dataStatus: string;
  trialOrGift: string;
  status: string;
}
