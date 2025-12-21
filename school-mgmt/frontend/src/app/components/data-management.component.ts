import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassItem, ClassService } from '../services/class.service';
import { StudentItem, StudentService } from '../services/student.service';
import { AttendanceService } from '../services/attendance.service';
import { UserItem, UserService } from '../services/user.service';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

interface SessionView {
  date: string;
  status: string;
  attendedAt?: string;
  sessionDuration?: number;
  salaryAmount?: number;
  classCode?: string;
  teacherCode?: string;
  teacherName?: string;
  lookupUrl?: string;
  imageUrl?: string;
}

interface DataRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  level?: string;
  dateOfBirth?: string;
  age?: number;
  saleName?: string;
  studentType?: 'ONLINE' | 'OFFLINE';
  classId?: string;
  classCode?: string;
  className?: string;
  teacherCodes?: string;
  teacherNames?: string;
  invoiceCodes?: string;
  sessionDuration?: number;
  sessionBalanceText?: string;
  studentStatus?: string;
  trialOrGift?: string;
  checkedBy?: string;
  sessions: SessionView[];
  totalAttendedSessions: number;
  status?: string;
}

@Component({
  selector: 'app-data-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="screen">
      <header class="control-bar">
        <div class="control-left">
          <div>
            <p class="eyebrow">Quản lý data</p>
            <h2>Data tổng hợp HS - Lớp - Điểm danh</h2>
          </div>
          <div class="control-stats">
            <span class="badge badge-total">Tổng: {{ rows().length }}</span>
            <span class="badge badge-active">Đang hiển thị: {{ paged().length }} / {{ filtered().length }}</span>
          </div>
        </div>
        <div class="control-actions">
          <button type="button" class="primary" (click)="loadData()" [disabled]="loading() || !classFilter()">Tải dữ liệu</button>
          <button type="button" class="ghost" (click)="reload()">Làm mới</button>
        </div>
      </header>

      <section class="filters-panel">
        <div class="filter-row compact aligned-left">
          <div class="filter short">
            <label>Từ khóa</label>
            <input placeholder="Mã HS, tên HS" [ngModel]="keyword()" (ngModelChange)="onKeywordChange($event)" />
          </div>
          <div class="filter short">
            <label>Lớp học</label>
            <select [ngModel]="classFilter()" (ngModelChange)="onClassFilterChange($event)">
              <option value="">Tất cả</option>
              <option *ngFor="let cls of classes()" [value]="cls._id">{{ cls.code }}</option>
            </select>
          </div>
          <div class="filter short">
            <label>Giáo viên</label>
            <select [ngModel]="teacherFilter()" (ngModelChange)="onTeacherFilterChange($event)">
              <option value="">Tất cả</option>
              <option *ngFor="let t of teacherOptions()" [value]="t.id">{{ t.label }}</option>
            </select>
          </div>
          <div class="filter short">
            <label>Loại HS</label>
            <select [ngModel]="studentTypeFilter()" (ngModelChange)="onStudentTypeFilterChange($event)">
              <option value="">Tất cả</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>
          <div class="filter short">
            <label>Trạng thái HS</label>
            <select [ngModel]="studentStatusFilter()" (ngModelChange)="onStudentStatusFilterChange($event)">
              <option value="">Tất cả</option>
              <option *ngFor="let st of studentStatusOptions" [value]="st">{{ st }}</option>
            </select>
          </div>
          <div class="filter tiny">
            <label>Tháng sinh</label>
            <select [ngModel]="dobMonthFilter()" (ngModelChange)="onDobMonthFilterChange($event)">
              <option value="">--</option>
              <option *ngFor="let m of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="m">{{ m }}</option>
            </select>
          </div>
          <div class="filter tiny">
            <label>Từ ngày</label>
            <input type="date" [ngModel]="startDate()" (ngModelChange)="onStartDateChange($event)" />
          </div>
          <div class="filter tiny">
            <label>Đến ngày</label>
            <input type="date" [ngModel]="endDate()" (ngModelChange)="onEndDateChange($event)" />
          </div>
          <div class="filter actions">
            <button type="button" class="ghost" (click)="resetFilters()">Đặt lại</button>
          </div>
        </div>

        <div class="filter-row aligned-left pagination-row">
          <div class="filter tiny">
            <label>Trang</label>
            <div class="pager">
              <button type="button" class="ghost" (click)="prevPage()" [disabled]="page() <= 1">‹</button>
              <span class="page-info">{{ page() }} / {{ totalPages() }}</span>
              <button type="button" class="ghost" (click)="nextPage()" [disabled]="page() >= totalPages()">›</button>
            </div>
          </div>
          <div class="filter tiny">
            <label>Kích thước trang</label>
            <select [ngModel]="pageSize()" (ngModelChange)="onPageSizeChange($event)">
              <option *ngFor="let sz of pageSizeOptions" [value]="sz">{{ sz }}</option>
            </select>
          </div>
          <div class="filter tiny">
            <label>Đang hiển thị</label>
            <div class="page-info">{{ paged().length }} / {{ filtered().length }}</div>
          </div>
        </div>
      </section>

      <section class="table-area">
        <div class="loading" *ngIf="loading()">Đang tải dữ liệu...</div>
        <ng-container *ngIf="filtered().length; else empty">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã HS</th>
                  <th>Loại HS</th>
                  <th class="col-student">Tên HS</th>
                  <th>Tên PH</th>
                  <th>Điện thoại</th>
                  <th>Level</th>
                  <th>Ngày sinh</th>
                  <th>Tuổi</th>
                  <th>Sale</th>
                  <th>Số hóa đơn</th>
                  <th>Số phút đăng ký</th>
                  <th class="col-sessions">Buổi còn lại</th>
                  <th>Trạng thái HS</th>
                  <th>Học thử/Buổi tặng</th>
                  <th>Mã lớp</th>
                  <th>Tên lớp</th>
                  <th>Mã GV trong lớp</th>
                  <th>GV + lương</th>
                  <th>Người check</th>
                  <th *ngFor="let col of sessionColumns">Buổi {{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <ng-container *ngFor="let row of paged()">
                  <ng-container *ngFor="let chunk of sessionChunks(row); let i = index">
                    <tr [class.continuation]="i > 0">
                      <ng-container *ngIf="i === 0; else spacer">
                        <td class="cell code">{{ row.studentCode }}</td>
                        <td class="cell type">{{ row.studentType || '-' }}</td>
                        <td class="cell student">{{ row.studentName }}</td>
                        <td class="cell parent">{{ row.parentName }}</td>
                        <td class="cell phone">{{ row.parentPhone }}</td>
                        <td class="cell level">{{ row.level || '-' }}</td>
                        <td class="cell dob">{{ formatDate(row.dateOfBirth) || '-' }}</td>
                        <td class="cell age">{{ row.age ?? '-' }}</td>
                        <td class="cell sale">{{ row.saleName || '-' }}</td>
                        <td class="cell invoice">{{ row.invoiceCodes || '-' }}</td>
                        <td class="cell duration">{{ row.sessionDuration ? row.sessionDuration + ' phút' : '-' }}</td>
                        <td class="cell sessions"><span class="session-balance">{{ row.sessionBalanceText || '-' }}</span></td>
                        <td class="cell status">{{ row.studentStatus || '-' }}</td>
                        <td class="cell gift">{{ row.trialOrGift || '-' }}</td>
                        <td class="cell class-code">{{ row.classCode || '-' }}</td>
                        <td class="cell class-name">{{ row.className || '-' }}</td>
                        <td class="cell teacher-code-list">{{ row.teacherCodes || '-' }}</td>
                        <td class="cell teacher-salary-list">{{ row.teacherNames || '-' }}</td>
                        <td class="cell checker">
                          <select [(ngModel)]="row.checkedBy">
                            <option value="">-- Chọn --</option>
                            <option *ngFor="let u of hcmsUsers()" [value]="u._id">{{ u.fullName }}</option>
                          </select>
                        </td>
                      </ng-container>
                      <ng-template #spacer>
                        <td class="cell" [attr.colspan]="19"></td>
                      </ng-template>

                      <td *ngFor="let col of sessionColumns" class="cell session" [ngClass]="[chunk[col-1] ? 'filled' : '', chunk[col-1] ? monthClass(chunk[col-1].date) : '']">
                        <ng-container *ngIf="chunk[col-1] as session; else emptyCell">
                          <div class="session-details">
                            <div *ngIf="session.attendedAt"><span class="label">Điểm danh:</span><span>{{ formatDateTime(session.attendedAt) }}</span></div>
                            <div><span class="label">GV:</span><span>{{ session.teacherCode || '-' }}{{ session.teacherName ? ' - ' + session.teacherName : '' }}</span></div>
                            <div><span class="label">Thời lượng:</span><span>{{ session.sessionDuration || '-' }}p</span></div>
                          </div>
                          <div class="session-actions">
                            <a *ngIf="session.lookupUrl" [href]="session.lookupUrl" target="_blank">Xem</a>
                            <a *ngIf="session.imageUrl" [href]="imageUrl(session.imageUrl)" target="_blank">Ảnh</a>
                          </div>
                        </ng-container>
                      </td>

                    </tr>
                  </ng-container>
                </ng-container>
              </tbody>
            </table>
          </div>
        </ng-container>
      </section>

      <div class="summary-bar" *ngIf="filtered().length">
        <span class="summary-label">Kết quả sau check</span>
        <span class="summary-item">Tổng số lương: <strong>{{ checkedTotalSalary() | number:'1.0-0' }} đ</strong></span>
      </div>
    </div>

    <ng-template #empty>
      <div class="empty-state">
        <p>Chưa có dữ liệu.</p>
      </div>
    </ng-template>
    <ng-template #emptyCell><span>-</span></ng-template>
  `,
  styles: [`
    .screen { display:flex; flex-direction:column; gap:12px; padding:10px; }
    .control-bar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:10px 12px; background:var(--panel); border:1px solid var(--border); border-radius:12px; }
    .control-left { display:flex; gap:12px; align-items:center; }
    .control-stats { display:flex; gap:8px; align-items:center; }
    .badge { padding:4px 8px; border-radius:8px; font-weight:600; font-size:12px; border:1px solid var(--border); }
    .badge-total { background:rgba(59,130,246,0.12); color:#bfdbfe; }
    .badge-active { background:rgba(16,185,129,0.12); color:#a7f3d0; }

    .filters-panel { display:flex; flex-direction:column; gap:6px; background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:8px; }
    .filter-row { display:flex; flex-wrap:wrap; gap:8px; align-items:end; }
    .filter-row.aligned-left { justify-content:flex-start; }
    .filter { min-width:150px; }
    .filter.short { min-width:140px; max-width:180px; }
    .filter.tiny { min-width:110px; max-width:140px; }
    .filter label { display:block; font-size:12px; color:var(--muted); margin-bottom:2px; }
    .filter input, .filter select { width:100%; padding:7px 8px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); }
    .filter.actions { display:flex; align-items:flex-end; }

    .table-area { display:flex; flex-direction:column; gap:8px; }
    .loading { padding:10px 12px; background:var(--panel); border:1px solid var(--border); border-radius:8px; color:var(--muted); width:max-content; }
    .table-wrapper { display:block; width:100%; max-width:100%; max-height:calc(100vh - 260px); overflow:auto; border:1px solid var(--border); border-radius:12px; background:var(--surface); padding-bottom:10px; scrollbar-gutter:stable both-edges; }
    .data-table { width:max-content; min-width:2600px; border-collapse:collapse; color:var(--text); }
    th, td { padding:6px 8px; border:1px solid var(--border); vertical-align:top; white-space:nowrap; }
    thead { background:#132544; color:var(--muted); }
    thead th { position:sticky; top:0; background:#132544; z-index:2; }
    .col-student { min-width:150px; }
    .col-sessions { min-width:260px; }
    .session-balance { white-space: pre-line; display: inline-block; font-size:12px; }
    .cell { font-size:13px; }
    .cell.session { min-width:180px; }
    .cell.session .session-details { display:flex; flex-direction:column; gap:2px; font-size:12px; }
    .cell.session .label { color:var(--muted); margin-right:4px; }
    .session-actions { display:flex; gap:6px; margin-top:4px; }
    .cell.parent { min-width:180px; }
    .cell.session.filled { background:rgba(59,130,246,0.06); }
    .cell.session.month-1 { background:rgba(59,130,246,0.12); }
    .cell.session.month-2 { background:rgba(16,185,129,0.15); }
    .cell.session.month-3 { background:rgba(244,114,182,0.15); }
    .cell.session.month-4 { background:rgba(248,180,0,0.15); }
    .cell.session.month-5 { background:rgba(94,234,212,0.15); }
    .cell.session.month-6 { background:rgba(251,146,60,0.15); }
    .cell.session.month-7 { background:rgba(129,140,248,0.18); }
    .cell.session.month-8 { background:rgba(52,211,153,0.15); }
    .cell.session.month-9 { background:rgba(248,113,113,0.15); }
    .cell.session.month-10 { background:rgba(192,132,252,0.15); }
    .cell.session.month-11 { background:rgba(125,211,252,0.15); }
    .cell.session.month-12 { background:rgba(252,211,77,0.18); }
    tr.continuation td { background:rgba(59,130,246,0.02); }
    .cell.checker select { min-width:140px; }

    .primary { background:var(--primary); color:#04121a; border:1px solid var(--primary-strong); padding:7px 10px; border-radius:8px; cursor:pointer; font-weight:600; }
    .ghost { border:1px solid var(--border); background:transparent; padding:7px 9px; border-radius:8px; cursor:pointer; color:var(--text); }

    .summary-bar { display:flex; gap:12px; align-items:center; padding:10px 12px; background:var(--panel); border:1px solid var(--border); border-radius:10px; font-weight:600; }
    .summary-label { color:var(--muted); text-transform:uppercase; letter-spacing:0.4px; }
    .summary-item strong { color:#bfdbfe; }

    .empty-state { text-align:center; padding:20px; }
    .eyebrow { margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); }
    h2 { margin:0; }
  `]
})
export class DataManagementComponent {
  classes = signal<ClassItem[]>([]);
  students = signal<StudentItem[]>([]);
  attendanceSessions = signal<Record<string, SessionView[]>>({});
  rows = signal<DataRow[]>([]);
  hcmsUsers = signal<UserItem[]>([]);
  studentStatusOptions = ['Đang học', 'Bảo lưu', 'Đã dừng học'];

  loading = signal(false);
  error = signal('');

  page = signal(1);
  pageSize = signal(50);
  pageSizeOptions = [20, 50, 100, 200];

  keyword = signal('');
  classFilter = signal('');
  teacherFilter = signal('');
  studentTypeFilter = signal('');
  studentStatusFilter = signal('');
  dobMonthFilter = signal('');
  startDate = signal(this.defaultStart());
  endDate = signal(this.defaultEnd());

  sessionColumns = Array.from({ length: 20 }, (_, i) => i + 1);

  checkedTotalSalary = computed(() =>
    this.filtered().reduce((sum, row) => {
      const sessionsTotal = (row.sessions || []).reduce((s, ss) => s + (ss.salaryAmount || 0), 0);
      return sum + sessionsTotal;
    }, 0)
  );

  filtered = computed(() => {
    const kw = this.keyword().trim().toLowerCase();
    const cls = this.classFilter();
    const teacher = this.teacherFilter();
    const studentType = this.studentTypeFilter();
    const status = this.studentStatusFilter();
    const dobMonth = this.dobMonthFilter();

    const data = this.rows();

    return data
      .filter((row) => {
        if (cls && row.classId !== cls) return false;
        if (teacher && !(row.teacherCodes || '').includes(teacher)) return false;
        if (studentType && (row.studentType || '') !== studentType) return false;
        if (status && (row.studentStatus || '') !== status) return false;
        if (dobMonth) {
          const dob = row.dateOfBirth ? new Date(row.dateOfBirth) : null;
          if (!dob || dob.getMonth() + 1 !== Number(dobMonth)) return false;
        }
        if (!kw) return true;
        return (
          row.studentCode.toLowerCase().includes(kw) ||
          row.studentName.toLowerCase().includes(kw) ||
          row.parentName.toLowerCase().includes(kw) ||
          (row.saleName || '').toLowerCase().includes(kw)
        );
      })
        .slice()
        .sort((a, b) => a.studentCode.localeCompare(b.studentCode));
  });

  paged = computed(() => {
    const size = this.pageSize();
    const totalPages = this.totalPages();
    const current = Math.min(this.page(), totalPages);
    const start = (current - 1) * size;
    return this.filtered().slice(start, start + size);
  });

  totalPages = computed(() => {
    const size = Math.max(1, this.pageSize());
    return Math.max(1, Math.ceil(this.filtered().length / size));
  });

  constructor(
    private classService: ClassService,
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private userService: UserService,
    private auth: AuthService,
  ) {
    this.reload();
  }

  private defaultStart() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }

  private defaultEnd() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  async reload() {
    this.loading.set(true);
    this.error.set('');
    this.attendanceSessions.set({});
    this.rows.set([]);
    try {
      const [cls, sts, users] = await Promise.all([
        this.classService.list(),
        this.studentService.list(),
        this.userService.list(),
      ]);
      this.classes.set(cls);
      this.students.set(sts);
      this.hcmsUsers.set(users.filter((u) => (u.role || '').toUpperCase() === 'HCNS'));
    } catch (err: any) {
      console.error('Không thể tải dữ liệu', err);
      this.error.set(err?.message || 'Không thể tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  async reloadAttendance() {
    const cls = this.classFilter();
    const start = this.startDate();
    const end = this.endDate();

    if (!cls) {
      this.error.set('Chọn lớp trước khi tải dữ liệu');
      this.attendanceSessions.set({});
      this.rows.set([]);
      return;
    }

    const startDateObj = start ? new Date(start) : null;
    const endDateObj = end ? new Date(end) : null;
    if (!startDateObj || !endDateObj || Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
      this.error.set('Ngày không hợp lệ');
      return;
    }
    const diffDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 14) {
      this.error.set('Chỉ tải tối đa 14 ngày, vui lòng thu hẹp khoảng ngày');
      return;
    }

    try {
      const report = await this.attendanceService.getAttendanceReport(start, end, cls);
      const byStudent: Record<string, SessionView[]> = {};
      (report || []).forEach((item: any) => {
        const studentId = item?.studentId?._id || item?.studentId;
        if (!studentId) return;
        if (!byStudent[studentId]) byStudent[studentId] = [];
        byStudent[studentId].push({
          date: item.date,
          status: item.status,
          attendedAt: item.attendedAt,
          sessionDuration: item.sessionDuration,
          salaryAmount: item.salaryAmount,
          classCode: item.classId?.code,
          teacherCode: this.teacherCode(item.teacherId?.email),
          teacherName: item.teacherId?.fullName,
          lookupUrl: item.lookupUrl,
          imageUrl: item.imageUrl,
        });
      });
      Object.values(byStudent).forEach(arr => arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      this.attendanceSessions.set(byStudent);
      this.buildRows();
    } catch (err) {
      console.error('Không thể tải báo cáo điểm danh', err);
      this.attendanceSessions.set({});
      this.buildRows();
      this.error.set(err instanceof Error ? err.message : 'Không thể tải báo cáo điểm danh');
    }
  }

  resetFilters() {
    this.keyword.set('');
    this.classFilter.set('');
    this.teacherFilter.set('');
    this.studentTypeFilter.set('');
    this.studentStatusFilter.set('');
    this.dobMonthFilter.set('');
    this.page.set(1);
  }

  private buildRows() {
    const rows: DataRow[] = [];

    this.classes().forEach((cls) => {
      (cls.students || []).forEach((s: any) => {
        const student = this.students().find((st) => st._id === (s?._id || s));
        if (!student) return;

        const user = this.auth.userSignal();
        if (user?.role === 'SALE' && student.saleId !== user.sub) return;

        const teachers = cls.teachers || [];
        const teacherCodes = teachers.map((t) => this.teacherCode(t.teacherId?.email)).filter(Boolean).join(', ');
        const teacherNames = teachers.map((t) => `${t.teacherId?.fullName || ''} (${t.salary2 || 0})`).filter(Boolean).join(', ');
        const invoiceCodes = ((student as any).payments || [])
          .filter((p: any) => {
            const status = (p.confirmStatus || '').toUpperCase();
            return p.invoiceCode && (status === 'CONFIRMED' || status === 'APPROVED');
          })
          .map((p: any) => p.invoiceCode)
          .join(', ');

        const sessionBalanceText = this.formatSessionBalance(student);
        const sessions = (this.attendanceSessions()[student._id] || []).filter((ss) => ss.classCode === cls.code);

        rows.push({
          studentId: student._id,
          studentCode: student.studentCode,
          studentName: student.fullName,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          level: student.level,
          dateOfBirth: student.dateOfBirth,
          age: student.age,
          saleName: student.saleName,
          studentType: student.studentType,
          classId: cls._id,
          classCode: cls.code,
          className: cls.name,
          teacherCodes,
          teacherNames,
          invoiceCodes,
          sessionDuration: this.deriveSessionDuration(student),
          sessionBalanceText,
          studentStatus: this.normalizeStudentStatus((student as any).dataStatus),
          trialOrGift: (student as any).trialOrGift,
          sessions,
          totalAttendedSessions: sessions.length,
          status: 'Đang hoạt động',
        });
      });
    });

    this.rows.set(rows);
  }

  teacherOptions() {
    const opts: { id: string; label: string }[] = [];
    this.classes().forEach((cls) => {
      (cls.teachers || []).forEach((t) => {
        const id = this.teacherCode(t.teacherId?.email) || t.teacherId?._id;
        const label = `${t.teacherId?.fullName || id}`;
        if (id && !opts.find((o) => o.id === id)) {
          opts.push({ id, label });
        }
      });
    });
    return opts;
  }

  monthClass(date?: string) {
    if (!date) return '';
    const d = new Date(date);
    const m = Number.isNaN(d.getTime()) ? null : d.getMonth() + 1;
    return m ? `month-${m}` : '';
  }

  formatDate(date?: string) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  formatDateTime(date?: string) {
    if (!date) return '';
    return new Date(date).toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
  }

  imageUrl(path?: string) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiBase}/${path}`;
  }

  teacherCode(email?: string) {
    if (!email) return '';
    const at = email.indexOf('@');
    if (at === -1) return email;
    return email.slice(0, at);
  }

  private deriveSessionDuration(st: StudentItem) {
    if (st.registeredSessionDuration) return st.registeredSessionDuration;
    const p = (st.payments || []).find((x: any) => x.sessionDuration);
    return p?.sessionDuration;
  }

  private formatSessionBalance(st: StudentItem) {
    const bal = (st as any).sessionBalances;
    const fmt = (val: number) => Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/\.00$/, '');
    const type = (st as any).studentType || '';

    if (type === 'OFFLINE') {
      const paid = Number.isFinite(bal?.basePaid70) ? Number(bal.basePaid70) : 0;
      const used = Number.isFinite(bal?.baseUsed70) ? Number(bal.baseUsed70) : 0;
      const remaining = Math.max(0, paid - used);
      return `${fmt(remaining)} buổi (đã thu ${fmt(paid)}, đã điểm danh ${fmt(used)})`;
    }

    if (!bal) return '—';
    const paid70 = Number.isFinite(bal.basePaid70) ? Number(bal.basePaid70) : 0;
    const used70 = Number.isFinite(bal.baseUsed70) ? Number(bal.baseUsed70) : 0;
    const remainingMinutes = Math.max(0, (paid70 - used70) * 70);
    const durations = [40, 50, 70, 90, 110, 120];

    const lines = durations.map((dur) => {
      const paid = Math.floor((paid70 * 70) / dur);
      const used = Math.floor((used70 * 70) / dur);
      const remaining = Math.max(0, Math.floor(remainingMinutes / dur));
      return `${dur}p: thu ${fmt(paid)} | đã DD ${fmt(used)} | còn ${fmt(remaining)}`;
    });

    return lines.join('\n');
  }

  private normalizeStudentStatus(status?: string) {
    const normalized = (status || '').toUpperCase();
    const map: Record<string, string> = {
      'ACTIVE': 'Đang học',
      'STUDYING': 'Đang học',
      'BAOLUU': 'Bảo lưu',
      'BAO_LUU': 'Bảo lưu',
      'PAUSED': 'Bảo lưu',
      'SUSPENDED': 'Bảo lưu',
      'STOPPED': 'Đã dừng học',
      'INACTIVE': 'Đã dừng học',
      'DA_DUNG_HOC': 'Đã dừng học'
    };
    if (map[normalized]) return map[normalized];
    const allowed = ['Đang học', 'Bảo lưu', 'Đã dừng học'];
    if (allowed.includes(status || '')) return status;
    return '';
  }

  sessionChunks(row: DataRow) {
    const sessions = (row.sessions || []).slice();
    sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const chunks: SessionView[][] = [];
    for (let i = 0; i < sessions.length; i += this.sessionColumns.length) {
      chunks.push(sessions.slice(i, i + this.sessionColumns.length));
    }
    if (!chunks.length) chunks.push([]);
    return chunks;
  }

  onKeywordChange(value: string) {
    this.keyword.set(value || '');
    this.page.set(1);
  }

  onClassFilterChange(value: string) {
    this.classFilter.set(value || '');
    this.page.set(1);
  }

  onTeacherFilterChange(value: string) {
    this.teacherFilter.set(value || '');
    this.page.set(1);
  }

  onStudentTypeFilterChange(value: string) {
    this.studentTypeFilter.set(value || '');
    this.page.set(1);
  }

  onStudentStatusFilterChange(value: string) {
    this.studentStatusFilter.set(value || '');
    this.page.set(1);
  }

  onDobMonthFilterChange(value: string) {
    this.dobMonthFilter.set(value || '');
    this.page.set(1);
  }

  onStartDateChange(value: string) {
    this.startDate.set(value || '');
    this.page.set(1);
  }

  onEndDateChange(value: string) {
    this.endDate.set(value || '');
    this.page.set(1);
  }

  async loadData() {
    this.loading.set(true);
    this.error.set('');
    this.page.set(1);
    try {
      await this.reloadAttendance();
    } finally {
      this.loading.set(false);
    }
  }

  onPageSizeChange(value: number) {
    const size = Number(value) || this.pageSize();
    this.pageSize.set(size);
    this.page.set(1);
  }

  prevPage() {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage() {
    const max = this.totalPages();
    this.page.update((p) => Math.min(max, p + 1));
  }
}
