import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassItem, ClassService } from '../services/class.service';
import { UserItem, UserService } from '../services/user.service';
import { AttendanceService } from '../services/attendance.service';
import { AuthService } from '../services/auth.service';

interface AttendanceReportItem {
  _id: string;
  date: string;
  attendedAt?: string;
  status?: string;
  imageUrl?: string;
  sessionDuration?: number;
  salaryAmount?: number;
  sessionContent?: string;
  comment?: string;
  recordLink?: string;
  parentConfirm?: string;
  paymentStatus?: number | string;
  checkedBy?: any;
  studentId: {
    _id: string;
    studentCode: string;
    fullName: string;
  };
  classId: {
    _id: string;
    name: string;
    code: string;
    classType?: 'ONLINE' | 'OFFLINE';
  };
  teacherId: {
    _id: string;
    fullName?: string;
    email?: string;
  };
  notes?: string;
  sessionIndex?: number;
}

interface ReportRow {
  rowId: string;
  attendanceDate: Date | null;
  index: number;
  attendanceDateStr: string;
  attendanceTimeStr: string;
  studentName: string;
  studentCode: string;
  teacherCode: string;
  classCode: string;
  className: string;
  sessionIndex?: number;
  sessionContent: string;
  comment: string;
  duration: number | undefined;
  salary: number;
  recordLink: string;
  imageUrl: string;
  parentConfirm: string;
  paymentStatus: number;
  checkedBy?: string;
  notes: string;
}

@Component({
  selector: 'app-teaching-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="report-screen">
      <header class="control-bar">
        <div>
          <h2>Báo cáo giảng dạy</h2>
          <p>
            <span>Chọn giáo viên và thời gian để xem tổng hợp điểm danh, lương.</span><br>
            <span>Tổng chưa thanh toán: <span class="strong">{{ unpaidTotal() | number:'1.0-0' }} đ</span>,</span><br>
            <span>Tổng đã thanh toán (khi trạng thái duyệt là Ok): <span class="strong">{{ paidTotal() | number:'1.0-0' }} đ</span></span>
          </p>
        </div>
        <div class="controls">
          <label>Năm
            <select [(ngModel)]="selectedYear" (ngModelChange)="onYearChange()">
              <option *ngFor="let y of availableYears" [value]="y">{{ y }}</option>
            </select>
          </label>
          <label>Giáo viên
            <select [(ngModel)]="teacherId" (ngModelChange)="buildRows()" [disabled]="isTeacher">
              <option value="">-- Chọn giáo viên --</option>
              <option *ngFor="let t of teachers()" [value]="t._id">{{ teacherLabel(t) }}</option>
            </select>
          </label>
          <label>Từ ngày
            <input type="date" [(ngModel)]="startDate" (ngModelChange)="reloadAttendance()" />
          </label>
          <label>Đến ngày
            <input type="date" [(ngModel)]="endDate" (ngModelChange)="reloadAttendance()" />
          </label>
          <label>TT check lương
            <select [(ngModel)]="paymentStatusFilter" (ngModelChange)="buildRows()">
              <option value="">Tất cả</option>
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PAID">Ok</option>
            </select>
          </label>
          <button class="ghost" (click)="reload()" [disabled]="loading()">{{ loading() ? 'Đang tải...' : 'Làm mới' }}</button>
        </div>
      </header>
      <div class="year-sections">
        <div class="year-block" *ngFor="let group of groupedRows()">
          <h2 class="year-title">Năm {{ group.year }}</h2>
          <div class="month-sections">
            <div class="month-card" *ngFor="let month of group.months">
              <div class="month-header">
                <h3>Tháng {{ month.month }} - Năm {{ group.year }}</h3>
                <span class="pill" *ngIf="month.rows.length">Số buổi: {{ month.rows.length }}</span>
              </div>

              <ng-container *ngIf="month.rows.length; else emptyMonth">
                <table class="report-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Mã GV</th>
                      <th>Điểm danh<br><small>Giờ + Ngày</small></th>
                      <th>Học viên</th>
                      <th>Mã lớp</th>
                      <th>Buổi số</th>
                      <th>Nội dung buổi học</th>
                      <th>Nhận xét</th>
                      <th>Thời lượng</th>
                      <th>Hình ảnh điểm danh</th>
                      <th>Lương GV</th>
                      <th>Link record</th>
                      <th>Xác nhận phụ huynh</th>
                      <th>Trung tâm check lương</th>
                      <th>Người Check</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of month.rows; trackBy: trackRow">
                      <td>{{ r.index }}</td>
                      <td class="nowrap">{{ r.teacherCode || '-' }}</td>
                      <td class="nowrap">
                        <div>{{ r.attendanceDateStr || '-' }}</div>
                        <div class="muted">{{ r.attendanceTimeStr || '-' }}</div>
                      </td>
                      <td>
                        <div class="bold">{{ r.studentCode || '-' }}</div>
                        <div class="muted">{{ r.studentName || '-' }}</div>
                      </td>
                      <td>
                        <div class="bold">{{ r.classCode || '-' }}</div>
                        <div class="muted">{{ r.className || '-' }}</div>
                      </td>
                      <td class="num">{{ r.sessionIndex || '-' }}</td>
                      <td>
                        <textarea class="inline wide" rows="2" [ngModel]="r.sessionContent" (ngModelChange)="updateField(r.rowId,'sessionContent',$event)"></textarea>
                      </td>
                      <td>
                        <textarea class="inline" rows="2" [ngModel]="r.comment" (ngModelChange)="updateField(r.rowId,'comment',$event)"></textarea>
                      </td>
                      <td class="num">{{ r.duration || '-' }}</td>
                      <td>
                        <a *ngIf="r.imageUrl" [href]="r.imageUrl" target="_blank">Xem</a>
                        <span *ngIf="!r.imageUrl">-</span>
                      </td>
                      <td class="num">{{ r.salary | number:'1.0-0' }}</td>
                      <td>
                        <input class="inline" [ngModel]="r.recordLink" (ngModelChange)="updateField(r.rowId,'recordLink',$event)" />
                      </td>
                      <td>
                        <input class="inline" [ngModel]="r.parentConfirm" (ngModelChange)="updateField(r.rowId,'parentConfirm',$event)" />
                      </td>
                      <td>
                        <input class="inline" type="number" min="0" [ngModel]="r.paymentStatus" (ngModelChange)="updateField(r.rowId,'paymentStatus',$event)" />
                      </td>
                      <td>
                        <select class="inline" [ngModel]="r.checkedBy" (ngModelChange)="updateField(r.rowId,'checkedBy',$event)">
                          <option value="">-- Chọn --</option>
                          <option *ngFor="let u of checkerUsers()" [value]="u._id">{{ checkerLabel(u) }}</option>
                        </select>
                      </td>
                      <td>
                        <textarea class="inline" rows="2" [ngModel]="r.notes" (ngModelChange)="updateField(r.rowId,'notes',$event)"></textarea>
                      </td>
                    </tr>
                    <tr class="summary-row">
                      <td class="summary-label" colspan="10">Tổng số lương đã thanh toán trong tháng</td>
                      <td class="num summary-value">{{ monthPaidTotal(month.rows) | number:'1.0-0' }}</td>
                      <td colspan="5"></td>
                    </tr>
                  </tbody>
                </table>
              </ng-container>
              <ng-template #emptyMonth>
                <div class="empty-month">Không có dữ liệu trong tháng này.</div>
              </ng-template>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display:block; color:#e2e8f0; }
    .report-screen { display:flex; flex-direction:column; gap:16px; }
    .control-bar { display:flex; justify-content:space-between; align-items:flex-end; background:linear-gradient(135deg,#081734,#102544); padding:16px; border-radius:12px; }
    .controls { display:flex; gap:12px; align-items:flex-end; }
    label { display:flex; flex-direction:column; gap:6px; font-size:13px; color:#cbd5f5; }
    select, input[type="month"], textarea, input[type="text"], input[type="url"], input { padding:8px 10px; border-radius:8px; border:1px solid rgba(99,102,241,0.35); background:rgba(12,23,45,0.9); color:#f8fafc; }
    select:focus, input:focus, textarea:focus { outline:none; border-color:#60a5fa; box-shadow:0 0 0 1px rgba(96,165,250,0.4); }
    .ghost { border:1px solid rgba(148,163,184,0.45); background:rgba(8,17,33,0.6); color:#e2e8f0; padding:8px 12px; border-radius:10px; cursor:pointer; }
    .table-wrap { overflow:auto; border-radius:12px; border:1px solid rgba(148,163,184,0.2); }
    table { width:100%; border-collapse:collapse; min-width:1300px; }
    th, td { border-bottom:1px solid rgba(148,163,184,0.14); padding:10px 12px; font-size:13px; vertical-align:top; }
    thead th { background:linear-gradient(135deg,#4338ca,#2563eb); color:#f8fafc; position:sticky; top:0; }
    tbody tr:nth-child(odd) td { background:rgba(12,24,46,0.9); }
    tbody tr:nth-child(even) td { background:rgba(9,18,38,0.92); }
    .num { text-align:right; }
    .bold { font-weight:600; }
    .muted { color:#94a3b8; font-size:12px; }
    .strong { font-weight:700; color:#93c5fd; }
    textarea { width:220px; resize:vertical; }
    .inline { width:140px; min-width:120px; border-radius:6px; border:1px solid rgba(148,163,184,0.4); background:rgba(12,23,45,0.85); color:#f8fafc; padding:6px 8px; }
    .inline.wide { width:200px; }
    .inline:focus { outline:none; border-color:#60a5fa; box-shadow:0 0 0 1px rgba(96,165,250,0.4); }
    .nowrap { white-space:nowrap; }
    .year-sections { display:flex; flex-direction:column; gap:24px; }
    .year-title { margin:0 0 4px 0; font-size:18px; color:#f8fafc; }
    .month-sections { display:flex; flex-direction:column; gap:18px; }
    .month-card { border-radius:12px; border:1px solid rgba(148,163,184,0.18); background:rgba(6,14,28,0.65); padding:12px; }
    .month-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .month-header h3 { margin:0; font-size:16px; }
    .pill { background:rgba(96,165,250,0.15); color:#bfdbfe; padding:4px 10px; border-radius:999px; font-size:12px; border:1px solid rgba(96,165,250,0.35); }
    .empty-month { text-align:center; padding:12px; background:rgba(7,16,32,0.6); border-radius:10px; color:#9ca3af; }
    .summary-row td { background:rgba(15,28,52,0.9); font-weight:600; border-top:2px solid rgba(148,163,184,0.35); }
    .summary-label { text-align:right; padding-right:12px; color:#cbd5e1; }
    .summary-value { color:#93c5fd; }
  `]
})
export class TeachingReportComponent implements OnInit {
  classes = signal<ClassItem[]>([]);
  teachers = signal<UserItem[]>([]);
  attendance = signal<AttendanceReportItem[]>([]);
  hcmsUsers = signal<UserItem[]>([]);
  checkerUsers = signal<UserItem[]>([]);
  teacherId = '';
  startDate = '';
  endDate = '';
  selectedYear = new Date().getFullYear();
  availableYears: number[] = [];
  paymentStatusFilter = '';
  rows = signal<ReportRow[]>([]);
  groupedRows = signal<Array<{ year: number; months: Array<{ month: number; rows: ReportRow[] }> }>>([]);
  loading = signal(false);
  canEditCheckColumns = this.auth.hasRole(['HCNS','MANAGER','DIRECTOR']);
  isTeacher = this.auth.hasRole(['TEACHER']);
  unpaidTotal = computed(() =>
    this.rows().filter((r) => this.normalizePaymentStatus(r.paymentStatus) !== 'PAID').reduce((sum, r) => sum + (r.salary || 0), 0)
  );
  paidTotal = computed(() =>
    this.rows().filter((r) => this.normalizePaymentStatus(r.paymentStatus) === 'PAID').reduce((sum, r) => sum + (r.salary || 0), 0)
  );

  constructor(
    private classService: ClassService,
    private userService: UserService,
    private attendanceService: AttendanceService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    if (this.isTeacher) {
      const user = this.auth.userSignal();
      this.teacherId = user?.sub || '';
    }
    this.buildAvailableYears();
    this.setDefaultDateRange();
    this.reload();
  }

  private buildAvailableYears() {
    const current = new Date().getFullYear();
    // Show a small window around current year for quick selection
    this.availableYears = [current - 2, current - 1, current, current + 1].filter((y) => y >= 2020);
  }

  private setDefaultDateRange() {
    // Default to the selected year so we can render 12 monthly tables
    const year = this.selectedYear || new Date().getFullYear();
    const firstDay = new Date(year, 0, 1);
    const lastDay = new Date(year, 11, 31);
    this.startDate = this.formatDateInput(firstDay);
    this.endDate = this.formatDateInput(lastDay);
  }

  async reload() {
    this.loading.set(true);
    try {
      const [classes, teachers, attendance, users] = await Promise.all([
        this.classService.list(),
        this.userService.listTeachers(),
        this.fetchAttendance(),
        this.userService.list(),
      ]);
      this.classes.set(classes);
      this.teachers.set(teachers);
      this.attendance.set(attendance);
      this.updateAvailableYearsFromData(attendance);
      const normalizedUsers = users.map((u) => ({ ...u, role: (u.role || '').toUpperCase() }));
      this.hcmsUsers.set(normalizedUsers.filter((u) => u.role === 'HCNS'));
      this.checkerUsers.set(normalizedUsers.filter((u) => ['DIRECTOR','MANAGER','HCNS'].includes(u.role)));
      this.buildRows();
    } finally {
      this.loading.set(false);
    }
  }

  async reloadAttendance() {
    this.loading.set(true);
    try {
      const attendance = await this.fetchAttendance();
      this.attendance.set(attendance);
      this.updateAvailableYearsFromData(attendance);
      this.buildRows();
    } finally {
      this.loading.set(false);
    }
  }

  buildRows() {
    const range = this.dateRange();
    const teacherId = this.isTeacher ? (this.auth.userSignal()?.sub || this.teacherId) : this.teacherId;
    const paymentFilter = this.paymentStatusFilter;
    const classMap = new Map<string, ClassItem>();
    this.classes().forEach((c) => classMap.set(c._id, c));
    const teacherMap = new Map<string, UserItem>();
    this.teachers().forEach((t) => teacherMap.set(t._id, t));

    const rows: ReportRow[] = [];
    let idx = 1;

    this.attendance()
      .filter((item) => this.inRange(item, range))
      .filter((item) => !teacherId || item.teacherId?._id === teacherId)
      .filter((item) => {
        const status = this.normalizePaymentStatus(item.paymentStatus);
        return paymentFilter ? status === paymentFilter : true;
      })
      .forEach((item) => {
        const attendanceDate = this.parseDate(item.attendedAt || item.date);
        if (!attendanceDate) return;
        const cls = classMap.get(item.classId?._id) || item.classId;
        const teacherInfo = teacherMap.get(item.teacherId?._id || '') || item.teacherId;
        const teacherCode = (teacherInfo as any)?.userCode || this.teacherCodeFromEmail(teacherInfo?.email) || item.teacherId?._id || '-';
        const classCode = (cls as ClassItem)?.code || item.classId?.code || '';
        const className = (cls as ClassItem)?.name || item.classId?.name || '';
        const salary = item.salaryAmount ?? this.computeSalaryForSession(cls as ClassItem, item.teacherId?._id, item.sessionDuration);
        const attendanceDateStr = this.formatDate(item.attendedAt || item.date);
        const attendanceTimeStr = this.formatTime(item.attendedAt || item.date);
        rows.push({
          rowId: item._id,
          attendanceDate,
          index: idx++,
          attendanceDateStr,
          attendanceTimeStr,
          studentName: item.studentId?.fullName || '',
          studentCode: item.studentId?.studentCode || '',
          teacherCode,
          classCode,
          className,
          sessionIndex: item.sessionIndex,
          sessionContent: item.sessionContent || '',
          comment: item.comment ?? item.notes ?? '',
          duration: item.sessionDuration,
          salary,
          recordLink: item.recordLink ?? '',
          imageUrl: item.imageUrl ?? '',
          parentConfirm: item.parentConfirm ?? '',
          paymentStatus: Number(item.paymentStatus ?? 0) || 0,
          checkedBy: (item as any).checkedBy?._id || (item as any).checkedBy || '',
          notes: item.notes || '',
        });
      });

    this.rows.set(rows);
    this.groupedRows.set(this.groupRowsByYearAndMonth(rows));
  }

  updateField(rowId: string, key: keyof ReportRow, value: any) {
    const clone = [...this.rows()];
    const idx = clone.findIndex((r) => r.rowId === rowId);
    if (idx < 0) return;
    if (this.isTeacher) {
      const allowed: Array<keyof ReportRow> = ['comment'];
      if (!allowed.includes(key)) return;
    }
    if (!this.canEditCheckColumns && (key === 'paymentStatus' || key === 'checkedBy')) {
      return;
    }
    const row = clone[idx];
    if (key === 'paymentStatus') {
      const num = Number(value);
      (row as any)[key] = Number.isFinite(num) ? num : 0;
    } else {
      (row as any)[key] = value;
    }
    this.rows.set(clone);
    // Không regroup để tránh mất focus input; month rows tham chiếu cùng object nên hiển thị cập nhật
    this.persistInline(rowId, { [key]: value });
  }

  trackRow(_i: number, row: ReportRow) {
    return row.rowId;
  }
  teacherLabel(t: UserItem): string {
    return `${this.teacherCodeFromEmail(t.email)} - ${t.fullName}`;
  }

  checkerLabel(u: UserItem): string {
    return `${(u as any).userCode || this.teacherCodeFromEmail(u.email)} - ${u.fullName}`;
  }

  teacherCodeFromEmail(email?: string): string {
    if (!email) return '';
    const [prefix] = email.split('@');
    return prefix || email;
  }

  inRange(entry: { attendedAt?: string; date?: string }, range: { start: Date | null; end: Date | null }): boolean {
    const val = entry.attendedAt || entry.date;
    if (!val) return false;
    const d = new Date(val);
    if (range.start && d < range.start) return false;
    if (range.end && d > range.end) return false;
    return true;
  }

  private dateRange(): { start: Date | null; end: Date | null } {
    const hasStart = !!this.startDate;
    const hasEnd = !!this.endDate;
    const start = hasStart ? new Date(this.startDate) : null;
    const end = hasEnd ? new Date(this.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private groupRowsByMonth(rows: ReportRow[]) {
    return this.groupRowsByYearAndMonth(rows);
  }

  private groupRowsByYearAndMonth(rows: ReportRow[]) {
    const byYear = new Map<number, Array<{ month: number; rows: ReportRow[] }>>();

    rows.forEach((r) => {
      if (!r.attendanceDate) return;
      const year = r.attendanceDate.getFullYear();
      const monthIdx = r.attendanceDate.getMonth();
      if (!byYear.has(year)) {
        byYear.set(year, Array.from({ length: 12 }, (_, i) => ({ month: i + 1, rows: [] as ReportRow[] })));
      }
      const months = byYear.get(year)!;
      months[monthIdx].rows.push(r);
    });

    const result = Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0]) // newest year first
      .map(([year, months]) => {
        months.forEach((m) => m.rows.sort((a, b) => {
          if (!a.attendanceDate || !b.attendanceDate) return 0;
          return b.attendanceDate.getTime() - a.attendanceDate.getTime();
        }));
        return { year, months: months.filter((m) => m.rows.length > 0) };
      });
    // Bỏ các năm không có dữ liệu sau khi lọc tháng trống
    return result.filter((g) => g.months.length > 0);
  }

  private normalizePaymentStatus(value: number | string | undefined): 'PAID' | 'UNPAID' {
    if (value === null || value === undefined || value === '') return 'UNPAID';
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 ? 'PAID' : 'UNPAID';
    }
    const num = Number(value);
    if (Number.isFinite(num)) return num > 0 ? 'PAID' : 'UNPAID';
    const upper = value.toString().toUpperCase();
    return upper === 'PAID' || upper === 'DA_THANH_TOAN' ? 'PAID' : 'UNPAID';
  }

  private computeSalaryForSession(cls: ClassItem | undefined, teacherId?: string, duration?: number): number {
    if (!cls || !duration || !Array.isArray((cls as any).teachers)) return 0;
    const teacher = (cls as any).teachers.find((t: any) => t.teacherId?._id === teacherId || t.teacherId === teacherId);
    if (!teacher) return 0;
    const map: Record<number, keyof typeof teacher> = {
      40: 'salary0',
      50: 'salary1',
      70: 'salary2',
      90: 'salary3',
      110: 'salary4',
      120: 'salary5',
    } as const;
    const key = map[duration];
    if (key && typeof teacher[key] === 'number') {
      return Number(teacher[key]) || 0;
    }
    // Fallback to 70p if duration not mapped
    return Number(teacher.salary2) || 0;
  }

  private async fetchAttendance(): Promise<AttendanceReportItem[]> {
    // Nếu thiếu khoảng thời gian, không gọi API để tránh lỗi backend
    const start = this.startDate || '';
    const end = this.endDate || '';
    if (!start || !end) return [];
    try {
      return await this.attendanceService.getAttendanceReport(start, end);
    } catch (err) {
      console.error('Không thể tải báo cáo điểm danh', err);
      return [];
    }
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

  private formatTime(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  private formatDateInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private parseDate(value?: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private updateAvailableYearsFromData(attendance: AttendanceReportItem[]) {
    const yearSet = new Set<number>(this.availableYears);
    attendance.forEach((item) => {
      const d = this.parseDate(item.attendedAt || item.date);
      if (d) {
        yearSet.add(d.getFullYear());
      }
    });

    const merged = Array.from(yearSet).filter((y) => y >= 2020).sort((a, b) => b - a);
    this.availableYears = merged.length ? merged : this.availableYears;

    if (!merged.includes(this.selectedYear) && merged.length) {
      this.selectedYear = merged[0];
      this.setDefaultDateRange();
    }
  }

  monthPaidTotal(rows: ReportRow[]): number {
    return rows.reduce((sum, r) => sum + (Number.isFinite(r.paymentStatus) ? r.paymentStatus : 0), 0);
  }

  private async persistInline(rowId: string, payload: Partial<Record<keyof ReportRow, any>>) {
    // Map frontend field names to backend payload keys
    const backendPayload: any = {};
    if ('comment' in payload) backendPayload.comment = payload.comment;
    if ('sessionContent' in payload) backendPayload.sessionContent = payload.sessionContent;
    if ('recordLink' in payload) backendPayload.recordLink = payload.recordLink;
    if ('parentConfirm' in payload) backendPayload.parentConfirm = payload.parentConfirm;
    if ('paymentStatus' in payload) {
      const num = Number((payload as any).paymentStatus);
      backendPayload.paymentStatus = Number.isFinite(num) ? num : 0;
    }
    if ('checkedBy' in payload) backendPayload.checkedBy = payload.checkedBy || null;
    if ('notes' in payload) backendPayload.notes = payload.notes;

    if (!Object.keys(backendPayload).length) return;

    const updated = await this.attendanceService.updateAttendance(rowId, backendPayload);
    if (updated) {
      // Keep local row in sync with canonical values returned
      const clone = [...this.rows()];
      const idx = clone.findIndex((r) => r.rowId === rowId);
      if (idx >= 0) {
        clone[idx].comment = updated.comment ?? updated.notes ?? clone[idx].comment;
        clone[idx].sessionContent = updated.sessionContent ?? clone[idx].sessionContent;
        clone[idx].recordLink = updated.recordLink ?? clone[idx].recordLink;
        clone[idx].parentConfirm = updated.parentConfirm ?? clone[idx].parentConfirm;
        clone[idx].paymentStatus = updated.paymentStatus ?? clone[idx].paymentStatus;
        clone[idx].checkedBy = (updated.checkedBy?._id || updated.checkedBy || '') ?? clone[idx].checkedBy;
        clone[idx].notes = updated.notes ?? clone[idx].notes;
        this.rows.set(clone);
      }
    }
  }

  onYearChange() {
    this.setDefaultDateRange();
    this.reloadAttendance();
  }
}
