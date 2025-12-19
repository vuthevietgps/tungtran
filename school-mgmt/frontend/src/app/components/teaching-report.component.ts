import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderItem, OrderService, OrderSessionEntry } from '../services/order.service';
import { ClassItem, ClassService } from '../services/class.service';
import { UserItem, UserService } from '../services/user.service';

interface ReportRow {
  index: number;
  date: string;
  studentName: string;
  teacherCode: string;
  classCode: string;
  attendanceCode: string;
  studyTime: string;
  sessionIndex: number;
  curriculum: string;
  comment: string;
  duration: number | undefined;
  salary: number;
  recordLink: string;
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
          <p>Chọn giáo viên và tháng để xem tổng hợp điểm danh, lương.</p>
        </div>
        <div class="controls">
          <label>Giáo viên
            <select [(ngModel)]="teacherId" (ngModelChange)="buildRows()">
              <option value="">-- Chọn giáo viên --</option>
              <option *ngFor="let t of teachers()" [value]="t._id">{{ teacherLabel(t) }}</option>
            </select>
          </label>
          <label>Tháng
            <input type="month" [(ngModel)]="month" (ngModelChange)="buildRows()" />
          </label>
          <button class="ghost" (click)="reload()">Làm mới</button>
        </div>
      </header>

      <section class="table-wrap" *ngIf="rows().length; else empty">
        <table class="report-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Ngày tháng</th>
              <th>Họ tên học sinh</th>
              <th>Giáo viên</th>
              <th>Mã lớp</th>
              <th>Mã điểm danh</th>
              <th>Giờ học</th>
              <th>Buổi số</th>
              <th>Giáo trình</th>
              <th>Nhận xét</th>
              <th>Thời lượng</th>
              <th>Số tiền</th>
              <th>Link record</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of rows()">
              <td>{{ r.index }}</td>
              <td>{{ r.date }}</td>
              <td>{{ r.studentName }}</td>
              <td>{{ r.teacherCode }}</td>
              <td>{{ r.classCode }}</td>
              <td>{{ r.attendanceCode }}</td>
              <td>{{ r.studyTime }}</td>
              <td>{{ r.sessionIndex }}</td>
              <td>{{ r.curriculum }}</td>
              <td>{{ r.comment }}</td>
              <td>{{ r.duration || '-' }}</td>
              <td class="num">{{ r.salary | number:'1.0-0' }}</td>
              <td>{{ r.recordLink }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <ng-template #empty>
        <div class="empty">Chọn giáo viên và tháng để xem dữ liệu.</div>
      </ng-template>

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
    table { width:100%; border-collapse:collapse; min-width:1100px; }
    th, td { border-bottom:1px solid rgba(148,163,184,0.14); padding:10px 12px; font-size:13px; vertical-align:top; }
    thead th { background:linear-gradient(135deg,#4338ca,#2563eb); color:#f8fafc; position:sticky; top:0; }
    tbody tr:nth-child(odd) td { background:rgba(12,24,46,0.9); }
    tbody tr:nth-child(even) td { background:rgba(9,18,38,0.92); }
    .num { text-align:right; }
    .strong { font-weight:700; color:#93c5fd; }
    textarea { width:220px; resize:vertical; }
    .empty { text-align:center; padding:24px; background:rgba(7,16,32,0.8); border-radius:12px; }
  `]
})
export class TeachingReportComponent implements OnInit {
  orders = signal<OrderItem[]>([]);
  classes = signal<ClassItem[]>([]);
  teachers = signal<UserItem[]>([]);
  teacherId = '';
  month = this.currentMonth();
  rows = signal<ReportRow[]>([]);

  constructor(
    private orderService: OrderService,
    private classService: ClassService,
    private userService: UserService,
  ) {}

  ngOnInit() {
    this.reload();
  }

  async reload() {
    const [orders, classes, teachers] = await Promise.all([
      this.orderService.list(),
      this.classService.list(),
      this.userService.listTeachers(),
    ]);
    this.orders.set(orders);
    this.classes.set(classes);
    this.teachers.set(teachers);
    this.buildRows();
  }

  buildRows() {
    const monthRange = this.monthRange();
    const teacherId = this.teacherId;
    const onlineClasses = new Map<string, string>();
    this.classes().forEach((c) => {
      if ((c as any).classType === 'ONLINE') {
        onlineClasses.set(c._id, c.code);
      }
    });

    const rows: ReportRow[] = [];
    let idx = 1;

    this.orders()
      .filter((o) => teacherId && o.teacherId === teacherId)
      .filter((o) => this.isOnlineOrder(o, onlineClasses))
      .forEach((order) => {
        const sessionsInMonth = (order.sessions || [])
          .filter((s) => this.inMonth(s, monthRange))
          .filter((s) => !!s.attendedAt); // điểm danh

        sessionsInMonth.forEach((s) => {
          const teacherCode = s.teacherCode || this.teacherCode(order);
          const classCode = s.classCode || order.classCode || onlineClasses.get(order.classId || '') || '';
          const salary = s.salaryAmount ?? order.teacherSalary ?? 0;
          rows.push({
            index: idx++,
            date: this.formatDate(s.date || s.attendedAt),
            studentName: order.studentName,
            teacherCode,
            classCode,
            attendanceCode: this.attendanceCode(order.studentCode, teacherCode, s.date || s.attendedAt, s.sessionIndex),
            studyTime: this.formatTime(s.attendedAt),
            sessionIndex: s.sessionIndex || 0,
            curriculum: '-',
            comment: (s as any).notes || '-',
            duration: s.sessionDuration,
            salary,
            recordLink: s.lookupUrl || s.imageUrl || '-',
          });
        });
      });

    this.rows.set(rows);
  }

  teacherLabel(t: UserItem): string {
    return `${this.teacherCodeFromEmail(t.email)} - ${t.fullName}`;
  }

  teacherCode(order: OrderItem): string {
    if (order.teacherCode) return order.teacherCode;
    const teacher = this.teachers().find(t => t._id === order.teacherId);
    return teacher ? this.teacherCodeFromEmail(teacher.email) : '-';
  }

  teacherCodeFromEmail(email?: string): string {
    if (!email) return '';
    const [prefix] = email.split('@');
    return prefix || email;
  }

  inMonth(session: OrderSessionEntry, range: { start: Date; end: Date }): boolean {
    const val = session.attendedAt || session.date;
    if (!val) return false;
    const d = new Date(val);
    return d >= range.start && d < range.end;
  }

  currentMonth(): string {
    const now = new Date();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  }

  monthRange(): { start: Date; end: Date } {
    if (!this.month) {
      const now = new Date();
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    }
    const [year, month] = this.month.split('-').map(Number);
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
  }

  attendanceCode(studentCode?: string, teacherCode?: string, sessionDate?: string, sessionIndex?: number): string {
    if (!studentCode || !teacherCode || !sessionDate) return '-';
    const date = new Date(sessionDate);
    if (Number.isNaN(date.getTime())) return '-';
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
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

  private formatTime(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  private isOnlineOrder(order: OrderItem, onlineClasses: Map<string, string>): boolean {
    if (order.studentType === 'ONLINE') return true;
    if (order.classId && onlineClasses.has(order.classId)) return true;
    const cls = this.classes().find((c) => c.code === order.classCode);
    return (cls as any)?.classType === 'ONLINE';
  }
}
