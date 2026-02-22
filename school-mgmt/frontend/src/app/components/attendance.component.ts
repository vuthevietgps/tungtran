import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { 
  AttendanceService, 
  AttendanceStatus, 
  AttendanceByClassResponse, 
  StudentAttendanceItem,
  BulkAttendancePayload 
} from '../services/attendance.service';
import { ClassItem } from '../services/class.service';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý điểm danh</h2>
      <p>Điểm danh học sinh theo lớp học được phân công.</p>
    </div>
  </header>

  <div class="attendance-controls">
    <div class="control-group">
      <label>
        Chọn lớp học:
        <select [(ngModel)]="selectedClassId" (change)="onClassChange()" [disabled]="loading()">
          <option value="">-- Chọn lớp học --</option>
          <option *ngFor="let cls of classes()" [value]="cls._id">
                {{cls.code}} - {{cls.name}} ({{cls.studentCount || cls.students?.length || 0}} học sinh)
          </option>
        </select>
      </label>
    </div>

    <div class="control-group">
      <label>
        Ngày điểm danh:
        <input 
          type="date" 
          [(ngModel)]="selectedDate" 
          (change)="onDateChange()"
          [disabled]="loading() || !selectedClassId"
          [max]="todayString"
        />
      </label>
    </div>

    <div class="control-group" *ngIf="selectedClassId && selectedDate">
      <button 
        class="primary" 
        (click)="loadAttendance()"
        [disabled]="loading()"
      >
        {{ loading() ? 'Đang tải...' : 'Tải danh sách' }}
      </button>
    </div>
  </div>

  <div class="error" *ngIf="error()">{{error()}}</div>

  <div class="attendance-content" *ngIf="attendanceData()">
    <div class="class-info">
      <h3>{{attendanceData()?.class?.code}} - {{attendanceData()?.class?.name}}</h3>
      <p>Ngày: {{formatDate(attendanceData()?.date)}}</p>
    </div>

    <div class="attendance-summary" *ngIf="attendanceData()?.attendanceList?.length">
      <div class="summary-stats">
        <span class="stat present">Có mặt: {{getStatusCount(AttendanceStatus.PRESENT)}}</span>
        <span class="stat absent">Vắng mặt: {{getStatusCount(AttendanceStatus.ABSENT)}}</span>
        <span class="stat late">Đi muộn: {{getStatusCount(AttendanceStatus.LATE)}}</span>
        <span class="stat excused">Xin phép: {{getStatusCount(AttendanceStatus.EXCUSED)}}</span>
        <span class="stat not-marked">Chưa điểm danh: {{getStatusCount(null)}}</span>
      </div>
    </div>

    <div class="attendance-actions" *ngIf="attendanceData()?.attendanceList?.length">
      <button class="secondary" (click)="markAllPresent()" [disabled]="saving()">
        Điểm danh tất cả "Có mặt"
      </button>
      <button class="primary" (click)="saveAttendance()" [disabled]="saving() || !hasChanges()">
        {{ saving() ? 'Đang lưu...' : 'Lưu điểm danh' }}
      </button>
    </div>

    <div class="attendance-list" *ngIf="attendanceData()?.attendanceList?.length; else noStudents">
      <div class="student-card" *ngFor="let item of attendanceData()?.attendanceList; trackBy: trackByStudentId">
        <div class="student-info">
          <h4>{{item.student.fullName}}</h4>
          <p>Tuổi: {{item.student.age}} - Phụ huynh: {{item.student.parentName}}</p>
        </div>
        
        <div class="student-actions">
          <button 
            class="btn btn-link" 
            (click)="generateLinkForStudent(item.student._id)"
            [disabled]="!selectedDate || generatingLink === item.student._id"
            title="Tạo link điểm danh cho học sinh">
            {{ generatingLink === item.student._id ? '⏳ Đang tạo...' : '🔗 Tạo link' }}
          </button>
        </div>

        <div class="attendance-controls-inline">
          <div class="status-selector">
            <label>
              <input 
                type="radio" 
                [name]="'status_' + item.student._id"
                [value]="AttendanceStatus.PRESENT"
                [(ngModel)]="item.attendance.status"
                (change)="onStatusChange(item)"
              />
              <span class="status-label present">Có mặt</span>
            </label>
            
            <label>
              <input 
                type="radio" 
                [name]="'status_' + item.student._id"
                [value]="AttendanceStatus.ABSENT"
                [(ngModel)]="item.attendance.status"
                (change)="onStatusChange(item)"
              />
              <span class="status-label absent">Vắng mặt</span>
            </label>
            
            <label>
              <input 
                type="radio" 
                [name]="'status_' + item.student._id"
                [value]="AttendanceStatus.LATE"
                [(ngModel)]="item.attendance.status"
                (change)="onStatusChange(item)"
              />
              <span class="status-label late">Đi muộn</span>
            </label>
            
            <label>
              <input 
                type="radio" 
                [name]="'status_' + item.student._id"
                [value]="AttendanceStatus.EXCUSED"
                [(ngModel)]="item.attendance.status"
                (change)="onStatusChange(item)"
              />
              <span class="status-label excused">Xin phép</span>
            </label>
          </div>
          
          <div class="notes-input" *ngIf="item.attendance.status && item.attendance.status !== AttendanceStatus.PRESENT">
            <input 
              type="text" 
              placeholder="Ghi chú (tùy chọn)"
              [(ngModel)]="item.attendance.notes"
              (input)="onNotesChange(item)"
            />
          </div>
        </div>
      </div>
    </div>

    <ng-template #noStudents>
      <p class="no-data">Lớp học này chưa có học sinh nào.</p>
    </ng-template>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header div h2 { margin:0 0 4px 0; color:#1e293b; }
    .page-header div p { margin:0; color:#64748b; }

    .attendance-controls { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:24px; padding:16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; }
    .control-group { display:flex; flex-direction:column; }
    .control-group label { font-weight:500; color:#374151; margin-bottom:4px; }
    .control-group select, .control-group input { padding:8px 12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; min-width:200px; }
    .control-group button { padding:8px 16px; border:none; border-radius:6px; font-weight:500; cursor:pointer; }
    .control-group button.primary { background:#2563eb; color:white; }
    .control-group button:disabled { opacity:0.5; cursor:not-allowed; }

    .error { color:#dc2626; background:#fef2f2; padding:12px; border-radius:6px; border:1px solid #fecaca; margin-bottom:16px; }

    .attendance-content { }
    .class-info { margin-bottom:20px; }
    .class-info h3 { margin:0 0 4px 0; color:#1e293b; }
    .class-info p { margin:0; color:#64748b; }

    .attendance-summary { margin-bottom:20px; }
    .summary-stats { display:flex; flex-wrap:wrap; gap:16px; }
    .stat { padding:8px 12px; border-radius:6px; font-size:14px; font-weight:500; }
    .stat.present { background:#dcfce7; color:#16a34a; }
    .stat.absent { background:#fee2e2; color:#dc2626; }
    .stat.late { background:#fef3c7; color:#d97706; }
    .stat.excused { background:#e0e7ff; color:#4f46e5; }
    .stat.not-marked { background:#f1f5f9; color:#64748b; }

    .attendance-actions { display:flex; gap:12px; margin-bottom:24px; }
    .attendance-actions button { padding:10px 20px; border:none; border-radius:6px; font-weight:500; cursor:pointer; }
    .attendance-actions button.primary { background:#2563eb; color:white; }
    .attendance-actions button.secondary { background:#6b7280; color:white; }
    .attendance-actions button:disabled { opacity:0.5; cursor:not-allowed; }

    .attendance-list { display:flex; flex-direction:column; gap:16px; }
    .student-card { background:white; border:1px solid #e5e7eb; border-radius:8px; padding:20px; }
    .student-info h4 { margin:0 0 4px 0; color:#1f2937; }
    .student-info p { margin:0; color:#6b7280; font-size:14px; }
    
    .student-actions { margin:12px 0; }
    .btn-link { 
      background:#8b5cf6; 
      color:white; 
      border:none; 
      padding:8px 16px; 
      border-radius:6px; 
      font-size:14px; 
      font-weight:500; 
      cursor:pointer; 
      transition: all 0.2s;
    }
    .btn-link:hover:not(:disabled) { background:#7c3aed; transform:translateY(-1px); }
    .btn-link:disabled { opacity:0.5; cursor:not-allowed; }

    .attendance-controls-inline { margin-top:16px; }
    .status-selector { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:12px; }
    .status-selector label { display:flex; align-items:center; cursor:pointer; }
    .status-selector input[type="radio"] { margin-right:6px; }
    .status-label { font-size:14px; font-weight:500; }
    .status-label.present { color:#16a34a; }
    .status-label.absent { color:#dc2626; }
    .status-label.late { color:#d97706; }
    .status-label.excused { color:#4f46e5; }

    .notes-input { }
    .notes-input input { width:100%; padding:8px 12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; }

    .no-data { text-align:center; color:#6b7280; font-style:italic; padding:32px; }
  `]
})
export class AttendanceComponent {
  // Expose enum to template
  readonly AttendanceStatus = AttendanceStatus;

  classes = signal<ClassItem[]>([]);
  attendanceData = signal<AttendanceByClassResponse | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  generatingLink = '';

  selectedClassId = '';
  selectedDate = '';
  todayString = '';

  private originalAttendanceData: Map<string, { status: AttendanceStatus | null; notes: string }> = new Map();

  constructor(
    private attendanceService: AttendanceService
  ) {
    this.todayString = this.formatLocalDateInput(new Date());
    this.selectedDate = this.todayString;
    this.loadClasses();
  }

  async loadClasses() {
    try {
      const classes = await this.attendanceService.getClassesWithStudents();

      const availableClasses: ClassItem[] = classes.map<ClassItem>((cls) => ({
        _id: cls.classId,
        name: cls.className || cls.classCode,
        code: cls.classCode,
        students: cls.students.map(student => ({
          _id: student.studentId,
          fullName: student.fullName,
          age: student.age,
          parentName: student.parentName
        })),
        studentCount: cls.studentCount,
      })).sort((a, b) => (a.code || '').localeCompare(b.code || '', 'vi', { sensitivity: 'base' }));

      this.classes.set(availableClasses);

      if (this.selectedClassId && !availableClasses.some(cls => cls._id === this.selectedClassId)) {
        this.selectedClassId = '';
        this.attendanceData.set(null);
      }
    } catch (error) {
      this.error.set('Không thể tải danh sách lớp học');
      console.error('Error loading classes:', error);
    }
  }

  onClassChange() {
    this.attendanceData.set(null);
    this.error.set('');
    if (this.selectedClassId && this.selectedDate) {
      this.loadAttendance();
    }
  }

  onDateChange() {
    this.attendanceData.set(null);
    this.error.set('');
    if (this.selectedClassId && this.selectedDate) {
      this.loadAttendance();
    }
  }

  async loadAttendance() {
    if (!this.selectedClassId || !this.selectedDate) return;

    this.loading.set(true);
    this.error.set('');

    try {
      // Load attendance data from backend (includes existing records)
      const data = await this.attendanceService.getAttendanceByClass(
        this.selectedClassId,
        this.selectedDate,
      );

      if (data) {
        this.attendanceData.set(data);
        this.saveOriginalData(data);
      } else {
        // Fallback: build from class data if backend returns null
        const selectedClass = this.classes().find(cls => cls._id === this.selectedClassId);
        if (!selectedClass) {
          this.error.set('Không tìm thấy thông tin lớp học');
          return;
        }
        const fallback: AttendanceByClassResponse = {
          class: { _id: selectedClass._id, name: selectedClass.name, code: selectedClass.code },
          date: this.selectedDate,
          attendanceList: (selectedClass.students || []).map(student => ({
            student: { _id: student._id, fullName: student.fullName, age: (student as any).age || null, parentName: (student as any).parentName || '' },
            attendance: { classId: selectedClass._id, studentId: student._id, date: this.selectedDate, status: null, notes: '' }
          }))
        };
        this.attendanceData.set(fallback);
        this.saveOriginalData(fallback);
      }
    } catch (error) {
      this.error.set('Có lỗi xảy ra khi tải dữ liệu điểm danh');
      console.error('Error loading attendance:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private saveOriginalData(data: AttendanceByClassResponse) {
    this.originalAttendanceData.clear();
    data.attendanceList.forEach(item => {
      this.originalAttendanceData.set(item.student._id, {
        status: item.attendance.status,
        notes: item.attendance.notes
      });
    });
  }

  onStatusChange(item: StudentAttendanceItem) {
    // Clear notes if status is PRESENT
    if (item.attendance.status === AttendanceStatus.PRESENT) {
      item.attendance.notes = '';
    }
  }

  onNotesChange(item: StudentAttendanceItem) {
    // Notes changed, no additional logic needed
  }

  markAllPresent() {
    const data = this.attendanceData();
    if (!data) return;

    data.attendanceList.forEach(item => {
      item.attendance.status = AttendanceStatus.PRESENT;
      item.attendance.notes = '';
    });
    
    // Trigger change detection
    this.attendanceData.set({ ...data });
  }

  hasChanges(): boolean {
    const data = this.attendanceData();
    if (!data) return false;

    return data.attendanceList.some(item => {
      const original = this.originalAttendanceData.get(item.student._id);
      return original?.status !== item.attendance.status || 
             original?.notes !== item.attendance.notes;
    });
  }

  async saveAttendance() {
    const data = this.attendanceData();
    if (!data || !this.hasChanges()) return;

    this.saving.set(true);
    this.error.set('');

    try {
      // Prepare bulk attendance data
      const attendances = data.attendanceList
        .filter(item => item.attendance.status !== null)
        .map(item => ({
          studentId: item.student._id,
          status: item.attendance.status!,
          notes: item.attendance.notes || ''
        }));

      const payload: BulkAttendancePayload = {
        classId: this.selectedClassId,
        date: this.selectedDate,
        attendances
      };

      const result = await this.attendanceService.bulkMarkAttendance(payload);
      
      if (result) {
        // Reload data to get updated state
        await this.loadAttendance();

        if (result.totalErrors > 0) {
          const studentNameMap = new Map(
            data.attendanceList.map((item) => [item.student._id, item.student.fullName]),
          );
          const preview = result.errors
            .slice(0, 3)
            .map((e) => `${studentNameMap.get(e.studentId) || e.studentId}: ${e.message}`)
            .join(' | ');
          const more =
            result.totalErrors > 3 ? ` (va ${result.totalErrors - 3} loi khac)` : '';
          this.error.set(
            `Da luu mot phan diem danh. Co ${result.totalErrors} hoc sinh loi. ${preview}${more}`,
          );
        }
      } else {
        this.error.set('Không thể lưu điểm danh. Vui lòng thử lại.');
      }
    } catch (error) {
      this.error.set('Có lỗi xảy ra khi lưu điểm danh');
      console.error('Error saving attendance:', error);
    } finally {
      this.saving.set(false);
    }
  }

  getStatusCount(status: AttendanceStatus | null): number {
    const data = this.attendanceData();
    if (!data || !data.attendanceList) return 0;
    
    return data.attendanceList.filter(item => item.attendance.status === status).length;
  }  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  trackByStudentId(index: number, item: StudentAttendanceItem): string {
    return item.student._id;
  }

  private formatLocalDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async generateLinkForStudent(studentId: string) {
    if (!this.selectedClassId || !this.selectedDate) {
      alert('Vui lòng chọn lớp và ngày trước khi tạo link');
      return;
    }

    this.generatingLink = studentId;
    this.error.set('');

    try {
      const result = await this.attendanceService.generateAttendanceLink(
        this.selectedClassId,
        studentId,
        this.selectedDate
      );

      // Clipboard can fail on some browsers/permissions; do not treat it as API failure.
      let copiedToClipboard = false;
      try {
        await navigator.clipboard.writeText(result.attendanceUrl);
        copiedToClipboard = true;
      } catch {
        copiedToClipboard = false;
      }
      
      // Show success message with link
      const studentName = this.attendanceData()?.attendanceList
        .find(item => item.student._id === studentId)?.student.fullName;
      
      const copyMessage = copiedToClipboard
        ? 'Link đã được copy vào clipboard:'
        : 'Không thể tự động copy. Vui lòng copy link thủ công:';
      alert(`✅ Đã tạo link điểm danh cho ${studentName}!\n\n${copyMessage}\n${result.attendanceUrl}\n\nHạn sử dụng: ${new Date(result.expiresAt).toLocaleString('vi-VN')}`);
    } catch (error: any) {
      this.error.set(error.message || 'Không thể tạo link điểm danh');
      alert('❌ ' + this.error());
    } finally {
      this.generatingLink = '';
    }
  }
}
