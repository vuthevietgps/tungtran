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
import { StudentService, StudentItem } from '../services/student.service';

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

    <div class="control-group" *ngIf="selectedClassId && classTeachers().length > 0">
      <label>
        Giáo viên điểm danh:
        <select [(ngModel)]="selectedTeacherId" [disabled]="loading()">
          <option value="">-- Chọn giáo viên --</option>
          <option *ngFor="let teacher of classTeachers()" [value]="teacher._id">
            {{teacher.fullName}} ({{teacher.email}})
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
        <span class="stat absent-without-permission">Vắng mặt không phép: {{getStatusCount(AttendanceStatus.ABSENT_WITHOUT_PERMISSION)}}</span>
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
          <p *ngIf="classType() === 'OFFLINE'">Số buổi còn lại: {{ getOfflineRemaining(item) }}</p>
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
                [value]="AttendanceStatus.ABSENT_WITHOUT_PERMISSION"
                [(ngModel)]="item.attendance.status"
                (change)="onStatusChange(item)"
              />
              <span class="status-label absent-without-permission">Vắng mặt không phép</span>
            </label>
          </div>

          <div class="duration-selector" *ngIf="classType() === 'ONLINE'">
            <div class="duration-list">
              <span class="label">Độ dài buổi:</span>
              <div class="duration-options">
                <label class="duration-option" *ngFor="let d of sessionDurations">
                  <input type="radio"
                         [name]="'duration_' + item.student._id"
                         [value]="d"
                         [(ngModel)]="item.attendance.sessionDuration"
                         (change)="onDurationChange(item)"
                         [disabled]="isDurationBlocked(item.student._id, d, item.attendance.status)" />
                  <span class="option-text">
                    {{d}} phút
                    <span *ngIf="getRemainingForDuration(item.student._id, d) as rem"> (còn {{rem}} buổi)</span>
                    <span *ngIf="isDurationBlocked(item.student._id, d, item.attendance.status)"> (hết quỹ)</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div class="salary-line" *ngIf="item.attendance.salaryAmount !== undefined">
            Lương buổi: <strong>{{ formatCurrency(item.attendance.salaryAmount || 0) }}</strong>
          </div>
          
          <div class="notes-input" *ngIf="item.attendance.status && item.attendance.status !== AttendanceStatus.PRESENT">
            <input 
              type="text" 
              placeholder="Ghi chú (tùy chọn)"
              [(ngModel)]="item.attendance.notes"
              (input)="onNotesChange(item)"
            />
          </div>
          
          <div class="absence-proof-upload" *ngIf="item.attendance.status === AttendanceStatus.ABSENT_WITHOUT_PERMISSION">
            <label class="file-upload-label">
              <input 
                type="file" 
                accept="image/*"
                (change)="handleAbsenceProofUpload($event, item)"
                style="display:none"
              />
              <span class="upload-button">📎 {{ item.attendance.absenceProofImage ? 'Thay đổi ảnh' : 'Tải ảnh đơn' }}</span>
            </label>
            <div *ngIf="item.attendance.absenceProofImage" class="image-preview">
              <img [src]="item.attendance.absenceProofImage" alt="Ảnh đơn xin phép" />
              <button class="remove-image" (click)="removeAbsenceProof(item)">×</button>
            </div>
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
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; color:var(--text); }
    .page-header div h2 { margin:0 0 4px 0; color:var(--text); }
    .page-header div p { margin:0; color:var(--muted); }

    .attendance-controls { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:24px; padding:16px; background:var(--panel); border-radius:12px; border:1px solid var(--border); }
    .control-group { display:flex; flex-direction:column; }
    .control-group label { font-weight:500; color:var(--muted); margin-bottom:4px; }
    .control-group select, .control-group input { padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:14px; min-width:200px; background:var(--surface); color:var(--text); }
    .control-group button { padding:10px 16px; border:1px solid var(--border); border-radius:8px; font-weight:600; cursor:pointer; background:var(--surface); color:var(--text); }
    .control-group button.primary { background:var(--primary); color:#04121a; border-color:var(--primary-strong); }
    .control-group button:disabled { opacity:0.5; cursor:not-allowed; }

    .error { color:var(--danger); background:rgba(244,63,94,0.12); padding:12px; border-radius:8px; border:1px solid var(--danger); margin-bottom:16px; }

    .attendance-content { }
    .class-info { margin-bottom:20px; color:var(--text); }
    .class-info h3 { margin:0 0 4px 0; color:var(--text); }
    .class-info p { margin:0; color:var(--muted); }

    .attendance-summary { margin-bottom:20px; }
    .summary-stats { display:flex; flex-wrap:wrap; gap:16px; }
    .stat { padding:8px 12px; border-radius:8px; font-size:14px; font-weight:600; border:1px solid var(--border); }
    .stat.present { background:rgba(52,211,153,0.15); color:#bbf7d0; }
    .stat.absent-with-permission { background:rgba(34,211,238,0.15); color:#a5f3fc; }
    .stat.late { background:rgba(245,158,11,0.18); color:#fcd34d; }
    .stat.absent-without-permission { background:rgba(244,63,94,0.18); color:#fecdd3; }
    .stat.not-marked { background:rgba(148,163,184,0.15); color:var(--muted); }

    .attendance-actions { display:flex; gap:12px; margin-bottom:24px; }
    .attendance-actions button { padding:10px 20px; border:1px solid var(--border); border-radius:10px; font-weight:600; cursor:pointer; background:var(--surface); color:var(--text); }
    .attendance-actions button.primary { background:var(--primary); color:#04121a; border-color:var(--primary-strong); }
    .attendance-actions button.secondary { background:var(--chip); color:var(--text); }
    .attendance-actions button:disabled { opacity:0.5; cursor:not-allowed; }

    .attendance-list { display:flex; flex-direction:column; gap:16px; }
    .student-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:20px; color:var(--text); }
    .student-info h4 { margin:0 0 4px 0; color:var(--text); }
    .student-info p { margin:0; color:var(--muted); font-size:14px; }
    
    .student-actions { margin:12px 0; }
    .btn-link { 
      background:var(--primary); 
      color:#04121a; 
      border:1px solid var(--primary-strong); 
      padding:8px 16px; 
      border-radius:8px; 
      font-size:14px; 
      font-weight:500; 
      cursor:pointer; 
      transition: all 0.2s;
    }
    .btn-link:hover:not(:disabled) { background:var(--primary-strong); transform:translateY(-1px); }
    .btn-link:disabled { opacity:0.5; cursor:not-allowed; }

    .attendance-controls-inline { margin-top:16px; }
    .status-selector { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:12px; }
    .status-selector label { display:flex; align-items:center; cursor:pointer; }
    .status-selector input[type="radio"] { margin-right:6px; }
    .status-label { font-size:14px; font-weight:500; }
    .status-label.present { color:#16a34a; }
    .status-label.absent-with-permission { color:#4f46e5; }
    .status-label.late { color:#d97706; }
    .status-label.absent-without-permission { color:#dc2626; }
    .duration-selector { margin-bottom:12px; }
    .duration-selector label { font-weight:500; color:#374151; display:flex; gap:8px; align-items:center; }
    .duration-selector select { padding:8px 12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; min-width:140px; }
    
    .absence-proof-upload { margin-top:12px; }
    .file-upload-label { display:inline-block; cursor:pointer; }
    .upload-button { 
      display:inline-block;
      padding:8px 16px; 
      background:#6366f1; 
      color:white; 
      border-radius:6px; 
      font-size:14px;
      font-weight:500;
      transition: background 0.2s;
    }
    .upload-button:hover { background:#4f46e5; }
    .image-preview { 
      margin-top:8px; 
      position:relative; 
      display:inline-block;
    }
    .image-preview img { 
      max-width:200px; 
      max-height:200px; 
      border:1px solid #d1d5db; 
      border-radius:6px;
    }
    .remove-image { 
      position:absolute; 
      top:-8px; 
      right:-8px; 
      width:24px; 
      height:24px; 
      background:#ef4444; 
      color:white; 
      border:none; 
      border-radius:50%; 
      cursor:pointer; 
      font-size:16px;
      line-height:1;
    }
    .remove-image:hover { background:#dc2626; }

    .notes-input { }
    .notes-input input { width:100%; padding:8px 12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; }

    .no-data { text-align:center; color:#6b7280; font-style:italic; padding:32px; }
  `]
})
export class AttendanceComponent {
  // Expose enum to template
  readonly AttendanceStatus = AttendanceStatus;
  readonly sessionDurations = [40, 50, 70, 90, 110];

  classes = signal<ClassItem[]>([]);
  classTeachers = signal<any[]>([]);
  attendanceData = signal<AttendanceByClassResponse | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  generatingLink = '';

  selectedClassId = '';
  selectedTeacherId = '';
  selectedDate = '';
  todayString = '';

  private originalAttendanceData: Map<string, { status: AttendanceStatus | null; notes: string; sessionDuration?: number }> = new Map();

  constructor(
    private attendanceService: AttendanceService,
    private studentService: StudentService
  ) {
    this.todayString = new Date().toISOString().split('T')[0];
    this.selectedDate = this.todayString;
    this.loadClasses();
  }

  async loadClasses() {
    try {
      const orderClasses = await this.attendanceService.getOrderClasses();

      const availableClasses: ClassItem[] = orderClasses.map<ClassItem>((cls) => ({
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

  async onClassChange() {
    this.attendanceData.set(null);
    this.classTeachers.set([]);
    this.selectedTeacherId = '';
    this.error.set('');
    
    if (this.selectedClassId) {
      // Load teachers for this class
      await this.loadClassTeachers();
      
      if (this.selectedDate) {
        this.loadAttendance();
      }
    }
  }

  async loadClassTeachers() {
    if (!this.selectedClassId) return;
    
    try {
      // Only load teachers for real classes (not virtual ones)
      if (!this.selectedClassId.startsWith('virtual_')) {
        const teachers = await this.attendanceService.getClassTeachers(this.selectedClassId);
        this.classTeachers.set(teachers);
        
        // Auto-select if only one teacher
        if (teachers.length === 1) {
          this.selectedTeacherId = teachers[0]._id;
        }
      }
    } catch (error) {
      console.error('Error loading class teachers:', error);
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
      // Find the selected class from our order-classes data
      const selectedClass = this.classes().find(cls => cls._id === this.selectedClassId);
      if (!selectedClass) {
        this.error.set('Không tìm thấy thông tin lớp học');
        return;
      }

      // Build attendance data from the class data we already have
      const attendanceData: AttendanceByClassResponse = {
        class: {
          _id: selectedClass._id,
          name: selectedClass.name,
          code: selectedClass.code,
          classType: (selectedClass as any).classType
        },
        date: this.selectedDate,
        attendanceList: (selectedClass.students || []).map(student => ({
          student: {
            _id: student._id,
            fullName: student.fullName,
            age: (student as any).age || null,
            parentName: (student as any).parentName || ''
          },
          attendance: {
            _id: undefined,
            classId: selectedClass._id,
            studentId: student._id,
            date: this.selectedDate,
            status: null,
            notes: '',
            attendedAt: null,
            imageUrl: null,
            sessionDuration: 70
          }
        }))
      };
      
      this.attendanceData.set(attendanceData);
      this.saveOriginalData(attendanceData);

      // Attach session balances for each student to support duration blocking
      try {
        const allStudents: StudentItem[] = await this.studentService.list();
        const balanceById = new Map<string, StudentItem['sessionBalances']>();
        const balanceByCode = new Map<string, StudentItem['sessionBalances']>();
        for (const st of allStudents) {
          if (st._id && st.sessionBalances) {
            balanceById.set(st._id, st.sessionBalances);
          }
          const codeKey = (st.studentCode || '').trim().toUpperCase();
          if (codeKey && st.sessionBalances) {
            balanceByCode.set(codeKey, st.sessionBalances);
          }
        }
        const current = this.attendanceData();
        if (current) {
          for (const item of current.attendanceList) {
            const byId = balanceById.get(item.student._id.toString());
            const codeKey = ((item.student as any).studentCode || '').trim().toUpperCase();
            const byCode = codeKey ? balanceByCode.get(codeKey) : undefined;
            (item as any).sessionBalances = byId || byCode || null;
          }
          this.attendanceData.set(current);
        }
      } catch (e) {
        console.warn('Không thể tải số buổi còn lại, tiếp tục không chặn độ dài:', e);
      }
    } catch (error) {
      this.error.set('Có lỗi xảy ra khi tải dữ liệu điểm danh');
      console.error('Error loading attendance:', error);
    } finally {
      this.loading.set(false);
    }
  }

  // Block duration options when remaining sessions for that duration < 1
  isDurationBlocked(studentId: string, duration: number, status?: AttendanceStatus | null): boolean {
    if (this.classType() === 'OFFLINE') return false;
    const consumes = status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE;
    if (!consumes) return false;

    const current = this.attendanceData();
    if (!current) return false;
    const entry = current.attendanceList.find(x => x.student._id.toString() === studentId);
    let balances = (entry as any)?.sessionBalances as StudentItem['sessionBalances'] | undefined;
    if (!balances) {
      const codeKey = ((entry?.student as any)?.studentCode || '').trim().toUpperCase();
      const all = current.attendanceList.map(it => (it as any).sessionBalances);
      // Try to find any balance attached via code (already attached per item above)
      balances = (entry as any)?.sessionBalances;
    }
    if (!balances) return false;
    switch (duration) {
      case 40: return (balances.remaining40 ?? 0) < 1;
      case 50: return (balances.remaining50 ?? 0) < 1;
      case 70: return (balances.remaining70 ?? 0) < 1;
      case 90: return (balances.remaining90 ?? 0) < 1;
      case 110: return (balances.remaining110 ?? 0) < 1;
      default: return false;
    }
  }

  // Get remaining sessions for a given duration for display
  getRemainingForDuration(studentId: string, duration: number): number | null {
    if (this.classType() === 'OFFLINE') return null;
    const current = this.attendanceData();
    if (!current) return null;
    const entry = current.attendanceList.find(x => x.student._id.toString() === studentId);
    const balances = (entry as any)?.sessionBalances as StudentItem['sessionBalances'] | undefined;
    if (!balances) return null;
    switch (duration) {
      case 40: return balances.remaining40 ?? null;
      case 50: return balances.remaining50 ?? null;
      case 70: return balances.remaining70 ?? null;
      case 90: return balances.remaining90 ?? null;
      case 110: return balances.remaining110 ?? null;
      default: return null;
    }
  }

  classType(): 'ONLINE' | 'OFFLINE' | undefined {
    return this.attendanceData()?.class?.classType as any;
  }

  getOfflineRemaining(item: StudentAttendanceItem): number {
    const balances = (item as any)?.sessionBalances as StudentItem['sessionBalances'] | undefined;
    if (!balances) return 0;
    const val = balances.remaining70Exact ?? balances.remaining70 ?? balances.basePaid70 ?? 0;
    return Math.max(0, Math.floor(val));
  }

  private saveOriginalData(data: AttendanceByClassResponse) {
    this.originalAttendanceData.clear();
    data.attendanceList.forEach(item => {
      this.originalAttendanceData.set(item.student._id, {
        status: item.attendance.status,
        notes: item.attendance.notes,
        sessionDuration: item.attendance.sessionDuration
      });
    });
  }

  onStatusChange(item: StudentAttendanceItem) {
    // Clear notes if status is PRESENT
    if (item.attendance.status === AttendanceStatus.PRESENT) {
      item.attendance.notes = '';
      item.attendance.absenceProofImage = undefined;
    }
  }

  onDurationChange(item: StudentAttendanceItem) {
    if (!item.attendance.sessionDuration) {
      item.attendance.sessionDuration = 70;
    }
  }

  onNotesChange(item: StudentAttendanceItem) {
    // Notes changed, no additional logic needed
  }

  async handleAbsenceProofUpload(event: any, item: StudentAttendanceItem) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước file không được vượt quá 5MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Upload to server (assuming similar endpoint as invoice receipts)
      const response = await fetch('http://localhost:3000/invoices/upload-receipt', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      item.attendance.absenceProofImage = result.url;
    } catch (error) {
      console.error('Error uploading absence proof:', error);
      alert('Không thể tải ảnh lên. Vui lòng thử lại.');
    }
  }

  removeAbsenceProof(item: StudentAttendanceItem) {
    item.attendance.absenceProofImage = undefined;
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
             original?.notes !== item.attendance.notes ||
             original?.sessionDuration !== item.attendance.sessionDuration;
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
          notes: item.attendance.notes || '',
          absenceProofImage: item.attendance.absenceProofImage,
          sessionDuration: item.attendance.sessionDuration || 70
        }));

      const payload: BulkAttendancePayload = {
        classId: this.selectedClassId,
        date: this.selectedDate,
        attendances
      };
      
      // Add teacherId if selected
      if (this.selectedTeacherId) {
        payload.teacherId = this.selectedTeacherId;
      }

      const success = await this.attendanceService.bulkMarkAttendance(payload);
      
      if (success) {
        // Reload data to get updated state
        await this.loadAttendance();
        // Success feedback could be added here
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

  formatCurrency(amount: number): string {
    return (amount || 0).toLocaleString('vi-VN') + ' đ';
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

      // Copy link to clipboard
      await navigator.clipboard.writeText(result.attendanceUrl);
      
      // Show success message with link
      const studentName = this.attendanceData()?.attendanceList
        .find(item => item.student._id === studentId)?.student.fullName;
      
      alert(`✅ Đã tạo link điểm danh cho ${studentName}!\n\nLink đã được copy vào clipboard:\n${result.attendanceUrl}\n\nHạn sử dụng: ${new Date(result.expiresAt).toLocaleString('vi-VN')}`);
    } catch (error: any) {
      this.error.set(error.message || 'Không thể tạo link điểm danh');
      alert('❌ ' + this.error());
    } finally {
      this.generatingLink = '';
    }
  }
}