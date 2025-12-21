import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, TeacherClassAssignment } from '../services/attendance.service';
import { ClassItem } from '../services/class.service';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

interface AttendanceReportItem {
  _id: string;
  date: string;
  attendedAt: string;
  status: string;
  imageUrl?: string;
  sessionDuration?: number;
  salaryAmount?: number;
  studentId: {
    _id: string;
    studentCode: string;
    fullName: string;
    age: number;
    parentName: string;
    faceImage?: string;
  };
  classId: {
    _id: string;
    name: string;
    code: string;
  };
  teacherId: {
    _id: string;
    fullName: string;
    email: string;
  };
  notes?: string;
}

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="report-container">
      <h1>📊 Báo cáo điểm danh tổng hợp</h1>

      <div class="filters">
        <div class="filter-group">
          <label>Từ ngày:</label>
          <input type="date" [(ngModel)]="startDate" (ngModelChange)="onFiltersChanged()" />
        </div>

        <div class="filter-group">
          <label>Đến ngày:</label>
          <input type="date" [(ngModel)]="endDate" (ngModelChange)="onFiltersChanged()" />
        </div>

        <div class="filter-group">
          <label>Lớp học (tùy chọn):</label>
          <select [(ngModel)]="selectedClassId" (ngModelChange)="onFiltersChanged()">
            <option value="">-- Tất cả các lớp --</option>
            <option *ngFor="let cls of classes()" [value]="cls._id">
              {{cls.code}} - {{cls.name}} ({{cls.studentCount || cls.students?.length || 0}} HS)
            </option>
          </select>
        </div>

        <button class="btn-search" (click)="loadReport()" [disabled]="loading()">
          {{ loading() ? '⏳ Đang tải...' : '🔄 Làm mới' }}
        </button>
      </div>

      <div *ngIf="error()" class="error-message">
        ❌ {{ error() }}
      </div>

      <div *ngIf="!loading() && reportData().length === 0 && !error()" class="no-data">
        Không có dữ liệu điểm danh trong khoảng thời gian này.
      </div>

      <div *ngIf="reportData().length > 0" class="report-summary">
        <div class="summary-card">
          <h3>Tổng số lượt điểm danh</h3>
          <p class="summary-number">{{ reportData().length }}</p>
        </div>
      </div>

      <div *ngIf="reportData().length > 0" class="report-table-container">
        <table class="report-table">
          <thead>
            <tr>
              <th>Mã buổi</th>
              <th>Ngày</th>
              <th>Thời gian điểm danh</th>
              <th>Mã lớp</th>
              <th>Mã HS</th>
              <th>Mã GV</th>
              <th>Thời lượng</th>
              <th>Hình ảnh điểm danh</th>
              <th>Lương GV</th>
              <th>Ghi chú</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reportData()">
              <td class="mono">{{ item._id }}</td>
              <td>{{ formatDate(item.date) }}</td>
              <td>{{ formatDateTime(item.attendedAt) }}</td>
              <td class="mono">{{ item.classId.code }}</td>
              <td class="mono">{{ item.studentId.studentCode }}</td>
              <td class="mono">{{ teacherCode(item.teacherId.email) || item.teacherId._id }}</td>
              <td>{{ item.sessionDuration || 70 }} phút</td>
              <td class="image-cell">
                <img 
                  *ngIf="item.imageUrl" 
                  [src]="getImageUrl(item.imageUrl)" 
                  alt="Ảnh điểm danh"
                  (click)="showImageModal(getImageUrl(item.imageUrl))"
                  class="thumbnail"
                />
                <span *ngIf="!item.imageUrl" class="no-image">Không có ảnh</span>
              </td>
              <td class="salary">{{ formatCurrency(item.salaryAmount || 0) }}</td>
              <td>{{ item.notes || '-' }}</td>
              <td class="actions">
                <button class="ghost" (click)="edit(item)">Sửa</button>
                <button class="ghost danger" (click)="remove(item)">Xóa</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Image Modal -->
      <div class="modal" *ngIf="modalImage()" (click)="closeImageModal()">
        <div class="modal-content">
          <span class="close">&times;</span>
          <img [src]="modalImage()" alt="Ảnh điểm danh" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --bg: #0c162c;
      --panel: #0f203d;
      --panel-strong: #132b50;
      --border: #1e365b;
      --text: #e8eef9;
      --muted: #9fb3d1;
      --primary: #5ad1ff;
      --primary-strong: #2ca0ff;
      --danger: #ff7b92;
      display:block;
      background:var(--bg);
      min-height:100vh;
      color:var(--text);
    }

    .report-container { padding:2rem; max-width:1400px; margin:0 auto; }
    h1 { color:var(--text); margin-bottom:1.5rem; font-weight:700; letter-spacing:0.2px; }

    .filters { 
      display:flex; 
      gap:16px; 
      flex-wrap:wrap; 
      background:var(--panel);
      padding:20px; 
      border-radius:12px; 
      border:1px solid var(--border);
      box-shadow:0 12px 40px rgba(0,0,0,0.35);
      margin-bottom:24px;
    }

    .filter-group { display:flex; flex-direction:column; gap:8px; min-width:200px; color:var(--muted); }
    .filter-group label { font-weight:600; color:var(--text); font-size:14px; }
    .filter-group input,
    .filter-group select { 
      padding:10px 12px; 
      border:1px solid var(--border); 
      border-radius:10px; 
      font-size:14px;
      background:#0b1a33;
      color:var(--text);
    }

    .btn-search { 
      align-self:flex-end;
      background:linear-gradient(120deg, var(--primary) 0%, var(--primary-strong) 100%);
      color:#031020; 
      border:none; 
      padding:12px 26px; 
      border-radius:12px; 
      font-weight:700; 
      cursor:pointer;
      transition: all 0.2s ease;
      box-shadow:0 10px 30px rgba(45,174,255,0.35);
    }
    .btn-search:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 12px 34px rgba(45,174,255,0.45); }
    .btn-search:disabled { opacity:0.55; cursor:not-allowed; box-shadow:none; }

    .error-message { 
      background:#3b0b1e; 
      color:#ff9ab5; 
      padding:16px; 
      border-radius:10px; 
      border:1px solid #69213d;
      margin-bottom:24px;
    }

    .no-data { 
      text-align:center; 
      color:var(--muted); 
      padding:48px; 
      background:var(--panel);
      border:1px solid var(--border);
      border-radius:12px;
      font-style:italic;
    }

    .report-summary { 
      display:flex; 
      gap:16px; 
      margin-bottom:24px; 
    }

    .summary-card { 
      background:radial-gradient(circle at 10% 10%, rgba(90,209,255,0.18), transparent 35%),
        linear-gradient(135deg, #1b3b6a 0%, #0f284d 40%, #0b1c36 100%);
      color:var(--text); 
      padding:24px; 
      border-radius:12px; 
      flex:1;
      border:1px solid var(--border);
      box-shadow:0 14px 40px rgba(0,0,0,0.45);
    }

    .summary-card h3 { margin:0 0 8px; font-size:14px; opacity:0.9; }
    .summary-number { margin:0; font-size:32px; font-weight:800; letter-spacing:0.5px; }

    .report-table-container { 
      background:var(--panel);
      border-radius:12px; 
      border:1px solid var(--border);
      box-shadow:0 12px 36px rgba(0,0,0,0.4);
      overflow-x:auto;
    }

    .report-table { 
      width:100%; 
      border-collapse:collapse;
      min-width:960px;
    }

    .report-table thead { 
      background:var(--panel-strong); 
      border-bottom:2px solid var(--border);
    }

    .report-table th { 
      padding:12px 16px; 
      text-align:left; 
      font-weight:700; 
      color:var(--text); 
      font-size:13px;
      letter-spacing:0.25px;
      white-space:nowrap;
    }

    .report-table td { 
      padding:12px 16px; 
      border-bottom:1px solid var(--border);
      font-size:14px;
      color:var(--text);
      background:linear-gradient(180deg, rgba(19,43,80,0.35) 0%, rgba(12,22,44,0.7) 100%);
    }

    .report-table tbody tr:nth-child(2n) td { background:linear-gradient(180deg, rgba(19,43,80,0.5) 0%, rgba(12,22,44,0.85) 100%); }

    .report-table tbody tr:hover td { 
      background:#1f3c67; 
      transition:background 0.15s ease;
    }

    .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size:12px; color:var(--muted); }
    .salary { font-weight:700; color:#8df0c8; white-space:nowrap; }
    .actions { display:flex; gap:8px; }
    .actions .ghost { padding:6px 10px; border-radius:8px; border:1px solid var(--border); background:transparent; cursor:pointer; color:var(--text); transition:all 0.15s; }
    .actions .ghost.danger { border-color:var(--danger); color:var(--danger); }
    .actions .ghost:hover { background:var(--panel-strong); }

    .image-cell { text-align:center; }

    .thumbnail { 
      width:80px; 
      height:80px; 
      object-fit:cover; 
      border-radius:8px; 
      cursor:pointer;
      border:2px solid var(--border);
      transition: all 0.2s;
      background:#0b1c33;
    }

    .thumbnail:hover { 
      transform:scale(1.05); 
      border-color:var(--primary);
      box-shadow:0 10px 28px rgba(90,209,255,0.3);
    }

    .no-image { 
      color:var(--muted); 
      font-style:italic; 
      font-size:12px;
    }

    /* Modal */
    .modal { 
      display:flex;
      position:fixed; 
      z-index:1000; 
      left:0; 
      top:0; 
      width:100%; 
      height:100%; 
      background:rgba(3,10,20,0.92);
      align-items:center;
      justify-content:center;
      backdrop-filter: blur(6px);
    }

    .modal-content { 
      position:relative;
      max-width:90%;
      max-height:90%;
      border-radius:12px;
      overflow:hidden;
      box-shadow:0 18px 40px rgba(0,0,0,0.6);
    }

    .modal-content img { 
      width:100%;
      height:auto;
      display:block;
    }

    .close { 
      position:absolute; 
      top:-44px; 
      right:0; 
      color:var(--text); 
      font-size:34px; 
      font-weight:700; 
      cursor:pointer;
      padding:8px 12px;
    }

    .close:hover { color:var(--primary); }
  `]
})
export class AttendanceReportComponent implements OnInit {
  private attendanceService = inject(AttendanceService);
  private auth = inject(AuthService);

  classes = signal<ClassItem[]>([]);
  reportData = signal<AttendanceReportItem[]>([]);
  loading = signal(false);
  error = signal('');
  modalImage = signal('');

  startDate = '';
  endDate = '';
  selectedClassId = '';

  ngOnInit() {
    // Set default date range to last 7 days
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    this.endDate = today.toISOString().split('T')[0];
    this.startDate = lastWeek.toISOString().split('T')[0];

    this.loadClasses();
    this.loadReport();
  }

  async loadClasses(): Promise<void> {
    try {
      const user = this.auth.userSignal();
      if (user?.role === 'TEACHER') {
        const teacherClasses = await this.attendanceService.getTeacherClasses();
        const mapped: ClassItem[] = teacherClasses.map<ClassItem>((cls: TeacherClassAssignment) => ({
          _id: cls.classId,
          name: cls.className || cls.classCode,
          code: cls.classCode,
          students: (cls.students || []).map((student) => ({
            _id: student.studentId,
            fullName: student.fullName,
          })),
          studentCount: cls.students?.length,
        })).sort((a, b) => (a.code || '').localeCompare(b.code || '', 'vi', { sensitivity: 'base' }));

        this.classes.set(mapped);
        if (this.selectedClassId && !mapped.some((c) => c._id === this.selectedClassId)) {
          this.selectedClassId = '';
        }
        if (!this.selectedClassId && mapped.length) {
          this.selectedClassId = mapped[0]._id;
        }
        return;
      }

      const orderClasses = await this.attendanceService.getOrderClasses();
      const mapped: ClassItem[] = orderClasses.map<ClassItem>((cls) => ({
        _id: cls.classId,
        name: cls.className || cls.classCode,
        code: cls.classCode,
        students: cls.students.map(student => ({
          _id: student.studentId,
          fullName: student.fullName,
        })),
        studentCount: cls.studentCount,
      })).sort((a, b) => (a.code || '').localeCompare(b.code || '', 'vi', { sensitivity: 'base' }));

      this.classes.set(mapped);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async loadReport() {
    if (!this.startDate || !this.endDate) {
      this.error.set('Vui lòng chọn khoảng thời gian');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const data = await this.attendanceService.getAttendanceReport(
        this.startDate,
        this.endDate,
        this.selectedClassId || undefined
      );

      console.log('Report data:', data);
      console.log('First student:', data[0]?.studentId);
      this.reportData.set(data);
    } catch (error: any) {
      this.error.set(error.message || 'Không thể tải báo cáo');
    } finally {
      this.loading.set(false);
    }
  }

  onFiltersChanged() {
    if (this.loading()) return;
    this.loadReport();
  }

  getImageUrl(imageUrl: string): string {
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    return `${environment.apiBase}${imageUrl}`;
  }

  showImageModal(imageUrl: string) {
    this.modalImage.set(imageUrl);
  }

  closeImageModal() {
    this.modalImage.set('');
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  teacherCode(email?: string): string {
    if (!email) return '';
    const [prefix] = email.split('@');
    return prefix || email;
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
  }

  edit(item: AttendanceReportItem) {
    alert('Chức năng sửa sẽ được bổ sung sau.');
  }

  remove(item: AttendanceReportItem) {
    alert('Chức năng xóa sẽ được bổ sung sau.');
  }
}
