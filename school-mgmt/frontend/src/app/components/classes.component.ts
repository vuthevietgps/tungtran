import { CommonModule } from '@angular/common';
import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassItem, ClassService } from '../services/class.service';
import { UserItem, UserService } from '../services/user.service';
import { StudentItem, StudentService } from '../services/student.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý lớp học</h2>
      <p>Tạo lớp, chọn giáo viên, nhân viên Sale và học viên tham gia.</p>
    </div>
    <button class="primary" (click)="openModal()" *ngIf="canCreateNewClass()">+ Thêm lớp học</button>
  </header>

  <section class="filters">
    <input placeholder="Tìm tên hoặc mã lớp" [ngModel]="keyword()" (ngModelChange)="keyword.set($event)" />
    <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)">
      <option value="">Tất cả loại lớp</option>
      <option value="ONLINE">Online</option>
      <option value="OFFLINE">Offline</option>
    </select>
    <ng-container *ngIf="!isTeacher(); else teacherNotice">
      <select [ngModel]="teacherFilter()" (ngModelChange)="teacherFilter.set($event)">
        <option value="">Tất cả giáo viên</option>
        <option *ngFor="let t of teachers()" [value]="t._id">{{t.fullName}}</option>
      </select>
      <button type="button" class="ghost" (click)="keyword.set(''); typeFilter.set(''); teacherFilter.set('');">Đặt lại</button>
    </ng-container>
    <ng-template #teacherNotice>
      <div class="muted">Chỉ hiển thị các lớp bạn được phân công.</div>
    </ng-template>
  </section>

  <div class="table-wrapper" *ngIf="filteredClasses().length; else empty">
    <table class="data">
      <thead>
        <tr>
          <th>Mã lớp</th>
          <th>Tên lớp</th>
          <th>Loại lớp</th>
          <th>Giáo viên</th>
          <th>Số học viên</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let c of filteredClasses()">
        <td>{{c.code}}</td>
        <td>{{c.name}}</td>
        <td><span class="badge" [class.badge-online]="c.classType === 'ONLINE'" [class.badge-offline]="c.classType === 'OFFLINE'">{{c.classType === 'ONLINE' ? 'Online' : 'Offline'}}</span></td>
        <td>
          <div *ngFor="let t of c.teachers" class="teacher-item">
            <span class="chip" [class.chip-primary]="t.canCreateAttendanceLink">{{t.teacherId.fullName}}</span>
            <span class="link-flag" *ngIf="t.canCreateAttendanceLink">Tạo link điểm danh</span>
          </div>
          <span *ngIf="!c.teachers?.length">—</span>
        </td>
        <td>{{c.studentCount || 0}}</td>
        <td class="actions-cell">
          <ng-container *ngIf="canManageClasses()">
            <button class="ghost" (click)="edit(c)">Sửa</button>
          </ng-container>
          <ng-container *ngIf="isDirector()">
            <button class="danger" (click)="remove(c)">Xóa</button>
          </ng-container>
        </td>
      </tr>
      </tbody>
    </table>
  </div>
  <ng-template #empty><p>Chưa có lớp học.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingId ? 'Chỉnh sửa lớp học' : 'Thêm lớp học' }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label>Tên lớp
          <input name="name" [(ngModel)]="form.name" required />
        </label>
        <label>Mã lớp
          <input name="code" [(ngModel)]="form.code" required />
        </label>
        <label>Loại lớp
          <select name="classType" [(ngModel)]="form.classType" required [disabled]="isSale()">
            <option value="" disabled [selected]="!form.classType">-- Chọn loại --</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE" [disabled]="isSale()">Offline</option>
          </select>
        </label>
        
        <div class="teacher-picker">
          <label>Giáo viên phụ trách (Tối đa 10 giáo viên)</label>
          <p class="muted" *ngIf="!canEditTeachers(form.classType)">Bạn không được chỉnh sửa giáo viên cho lớp này.</p>
          
          <!-- Danh sách giáo viên đã chọn -->
          <div class="selected-teachers" *ngIf="form.teachers.length">
            <div *ngFor="let t of form.teachers" class="teacher-card">
              <div class="teacher-header">
                <span class="teacher-name">{{ getTeacherName(t.teacherId) }}</span>
                <button 
                  type="button" 
                  class="remove-btn" 
                  (click)="removeTeacher(t.teacherId)" [disabled]="!canEditTeachers(form.classType)">×</button>
              </div>
              <div class="link-row">
                <button type="button" class="ghost small" (click)="markAttendanceCreator(t.teacherId)" [disabled]="!canEditTeachers(form.classType)">
                  {{ t.canCreateAttendanceLink ? 'Đã chọn tạo link điểm danh' : 'Chọn làm người tạo link điểm danh' }}
                </button>
                <span *ngIf="t.canCreateAttendanceLink" class="link-selected">Chỉ giáo viên này được tạo link điểm danh</span>
              </div>
              <ng-container *ngIf="form.classType === 'ONLINE'; else offlineSalaries">
                <div class="salaries-grid">
                  <div class="salary-input-group">
                    <label>Lương 40 phút</label>
                    <input type="number" [(ngModel)]="t.salary0" [ngModelOptions]="{ standalone: true }" min="0" step="1000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                  <div class="salary-input-group">
                    <label>Lương 50 phút</label>
                    <input type="number" [(ngModel)]="t.salary1" [ngModelOptions]="{ standalone: true }" min="0" step="1000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                  <div class="salary-input-group">
                    <label>Lương 70 phút</label>
                    <input type="number" [(ngModel)]="t.salary2" [ngModelOptions]="{ standalone: true }" min="0" step="1000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                  <div class="salary-input-group">
                    <label>Lương 90 phút</label>
                    <input type="number" [(ngModel)]="t.salary3" [ngModelOptions]="{ standalone: true }" min="0" step="1000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                  <div class="salary-input-group">
                    <label>Lương 110 phút</label>
                    <input type="number" [(ngModel)]="t.salary4" [ngModelOptions]="{ standalone: true }" min="0" step="1000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                  <div class="salary-input-group">
                    <label>Lương 120 phút</label>
                    <input type="number" [(ngModel)]="t.salary5" [ngModelOptions]="{ standalone: true }" min="0" step="1000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                </div>
              </ng-container>
              <ng-template #offlineSalaries>
                <div class="offline-grid">
                  <div class="salary-input-group">
                    <label>Mức lương 1 (3 tháng đầu)</label>
                    <input type="number" [(ngModel)]="t.offlineSalary1" [ngModelOptions]="{ standalone: true }" min="0" step="50000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                  <div class="salary-input-group">
                    <label>Mức lương 2 (3 tháng tiếp theo)</label>
                    <input type="number" [(ngModel)]="t.offlineSalary2" [ngModelOptions]="{ standalone: true }" min="0" step="50000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                  <div class="salary-input-group">
                    <label>Mức lương 3 (3 tháng tiếp theo)</label>
                    <input type="number" [(ngModel)]="t.offlineSalary3" [ngModelOptions]="{ standalone: true }" min="0" step="50000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                  <div class="salary-input-group">
                    <label>Mức lương 4 (3 tháng tiếp theo)</label>
                    <input type="number" [(ngModel)]="t.offlineSalary4" [ngModelOptions]="{ standalone: true }" min="0" step="50000" [disabled]="!canEditTeachers(form.classType)" />
                  </div>
                </div>
              </ng-template>
            </div>
          </div>
          
          <!-- Dropdown thêm giáo viên -->
          <select 
            #teacherSelect
            class="add-teacher-select"
            (change)="addTeacher(teacherSelect.value); teacherSelect.value = ''"
            [disabled]="form.teachers.length >= 10 || !canEditTeachers(form.classType)">
            <option value="">-- Thêm giáo viên --</option>
            <option 
              *ngFor="let t of teachers()" 
              [value]="t._id"
              [disabled]="isTeacherSelected(t._id)">
              {{t.fullName}} ({{t.email}})
            </option>
          </select>
          <p *ngIf="form.teachers.length >= 10" class="warning">Đã đạt giới hạn 10 giáo viên</p>
        </div>

        <div class="student-picker">
          <label>Chọn học sinh (chỉ hiện học sinh có hóa đơn đã duyệt)</label>
          <div class="student-lists">
            <div class="student-panel">
              <div class="panel-header">
                <span>Danh sách học sinh</span>
                <input
                  placeholder="Tìm mã / tên"
                  [ngModel]="studentSearch()"
                  (ngModelChange)="studentSearch.set($event)"
                />
              </div>
              <div class="panel-body">
                <div *ngFor="let s of availableStudentList()" class="student-row">
                  <div class="student-meta">
                    <strong>{{s.studentCode}}</strong>
                    <span>{{s.fullName}}</span>
                    <small *ngIf="s.saleName">Sale: {{s.saleName}}</small>
                  </div>
                  <button type="button" class="ghost" (click)="addStudent(s._id)" [disabled]="isStudentSelected(s._id)">Thêm</button>
                </div>
                <p class="muted" *ngIf="!availableStudentList().length">Không có học sinh đủ điều kiện</p>
              </div>
            </div>

            <div class="student-panel">
              <div class="panel-header">
                <span>Học sinh trong lớp</span>
              </div>
              <div class="panel-body">
                <div *ngFor="let s of selectedStudentList()" class="student-row">
                  <div class="student-meta">
                    <strong>{{s.studentCode}}</strong>
                    <span>{{s.fullName}}</span>
                    <small *ngIf="s.saleName">Sale: {{s.saleName}}</small>
                  </div>
                  <button type="button" class="danger" (click)="removeStudent(s._id)">Gỡ</button>
                </div>
                <p class="muted" *ngIf="!selectedStudentList().length">Chưa chọn học sinh</p>
              </div>
            </div>
          </div>
        </div>
        <div class="actions">
          <button type="submit" class="primary">{{ submitLabel }}</button>
          <button type="button" (click)="closeModal()">Huỷ</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; color:var(--text); }
    .filters { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:8px; margin-bottom:10px; align-items:center; }
    .filters input, .filters select { padding:8px 10px; }
    .data { width:100%; border-collapse:collapse; background:var(--surface); color:var(--text); }
    th, td { padding:8px; border:1px solid var(--border); vertical-align:top; }
    thead { background:#132544; color:var(--muted); }
    thead th { position:sticky; top:0; background:#132544; z-index:1; }
    .table-wrapper { max-height:70vh; overflow:auto; border:1px solid var(--border); border-radius:10px; }
    .chip { display:inline-block; background:var(--chip); color:var(--text); padding:2px 8px; border-radius:999px; margin:0 4px 4px 0; font-size:12px; border:1px solid var(--border); }
    .chip-primary { background:rgba(59,130,246,0.2); border-color:#3b82f6; color:#bfdbfe; }
    .link-flag { font-size:11px; color:#60a5fa; margin-left:6px; }
    .badge { display:inline-block; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; border:1px solid var(--border); }
    .badge-online { background:rgba(34,211,238,0.18); color:#a5f3fc; }
    .badge-offline { background:rgba(245,158,11,0.18); color:#fcd34d; }
    .salary-level { font-weight:600; color:#22d3ee; }
    .primary { background:var(--primary); color:#04121a; border:1px solid var(--primary-strong); padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:600; }
    .ghost { border:1px solid var(--border); background:transparent; padding:6px 10px; border-radius:8px; cursor:pointer; margin-right:6px; color:var(--text); }
    .ghost.small { padding:4px 8px; font-size:12px; margin-right:0; }
    .danger { border:1px solid var(--danger); background:var(--danger); color:#fff; padding:6px 10px; border-radius:8px; cursor:pointer; }
    .ghost:hover, .danger:hover { opacity:.9; }
    select, input { padding:8px 10px; border:1px solid var(--border); border-radius:8px; width:100%; background:var(--panel); color:var(--text); }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { white-space:nowrap; width:140px; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(4,12,30,.75); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:var(--surface); padding:20px; border-radius:12px; width:940px; max-height:90vh; overflow:auto; box-shadow:0 20px 50px rgba(0,0,0,0.55); border:1px solid var(--border); color:var(--text); z-index:1001; position:relative; }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .error { color:#dc2626; }
    .teacher-picker { margin-bottom:12px; }
    .teacher-picker > label { display:block; font-weight:500; margin-bottom:8px; }
    .teacher-item { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
    .selected-teachers { margin-bottom:12px; }
    .teacher-card { background:rgba(12,24,46,0.9); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px; color:var(--text); }
    .teacher-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .link-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
    .link-selected { color:#34d399; font-size:12px; }
    .teacher-name { font-weight:600; color:var(--text); font-size:14px; }
    .remove-btn { background:var(--danger); color:#fff; border:none; width:24px; height:24px; border-radius:50%; cursor:pointer; font-size:16px; line-height:1; flex-shrink:0; }
    .remove-btn:hover { background:#ef4444; }
    .salaries-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
    .offline-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; }
    .salary-input-group { display:flex; flex-direction:column; }
    .salary-input-group label { font-size:12px; font-weight:500; color:var(--muted); margin-bottom:4px; }
    .salary-input-group input { padding:8px 10px; border:1px solid var(--border); border-radius:8px; font-size:13px; background:var(--panel); color:var(--text); }
    .add-teacher-select { margin-top:8px; }
    .warning { color:#d97706; font-size:12px; margin:4px 0 0 0; }
    .student-picker { margin-top:12px; display:flex; flex-direction:column; gap:10px; }
    .student-lists { display:grid; grid-template-columns: repeat(2, minmax(300px, 1fr)); gap:10px; align-items:start; }
    .student-panel { border:1px solid var(--border); border-radius:10px; background:rgba(12,24,46,0.8); display:flex; flex-direction:column; min-height:180px; }
    .panel-header { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid var(--border); }
    .panel-header input { max-width:160px; }
    .panel-body { padding:8px; display:flex; flex-direction:column; gap:8px; max-height:240px; overflow:auto; }
    .student-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.02); }
    .student-meta { display:flex; flex-direction:column; gap:2px; font-size:13px; }
    .student-meta strong { font-size:13px; color:var(--text); }
    .student-meta span { font-size:13px; }
    .student-meta small { color:var(--muted); }
    .muted { color:var(--muted); font-size:12px; }
  `]
})
export class ClassesComponent {
  classes = signal<ClassItem[]>([]);
  teachers = signal<UserItem[]>([]);
  students = signal<StudentItem[]>([]);
  keyword = signal('');
  typeFilter = signal<'' | 'ONLINE' | 'OFFLINE'>('');
  teacherFilter = signal('');
  studentSearch = signal('');
  showModal = signal(false);
  error = signal('');
  editingId: string | null = null;
  form = this.blankForm();
  submitLabel = 'Lưu';

  filteredClasses = computed(() => {
    const kw = this.keyword().trim().toLowerCase();
    const type = this.typeFilter();
    const teacher = this.teacherFilter();
    const user = this.auth.userSignal();
    const currentTeacherId = user?.sub || '';
    const isTeacher = user?.role === 'TEACHER';

    return this.classes().filter((c) => {
      if (isTeacher && currentTeacherId && !this.classHasTeacher(c, currentTeacherId)) return false;
      if (kw && !(c.name.toLowerCase().includes(kw) || c.code.toLowerCase().includes(kw))) return false;
      if (type && c.classType !== type) return false;
      if (teacher && !(c.teachers || []).some(t => this.normalizeTeacherId(t.teacherId) === teacher)) return false;
      return true;
    });
  });

  constructor(
    private classService: ClassService,
    private userService: UserService,
    private studentService: StudentService,
    private auth: AuthService,
  ) {
    this.loadTeachers();
    this.loadStudents();
    this.reload();
  }

  blankForm() {
    return { 
      name: '', 
      code: '', 
      classType: '' as '' | 'ONLINE' | 'OFFLINE',
      teachers: [] as { teacherId: string; salary0: number; salary1: number; salary2: number; salary3: number; salary4: number; salary5: number; offlineSalary1?: number; offlineSalary2?: number; offlineSalary3?: number; offlineSalary4?: number; canCreateAttendanceLink?: boolean }[], 
      studentIds: [] as string[]
    };
  }

  async loadTeachers() {
    const users = await this.userService.list();
    this.teachers.set(users.filter((u) => u.role === 'TEACHER'));
  }

  async loadStudents() {
    const data = await this.studentService.list();
    this.students.set(data);
  }

  addTeacher(teacherId: string) {
    if (!this.canEditTeachers(this.form.classType)) return;
    if (this.form.teachers.length >= 10) {
      alert('Không được phân công quá 10 giáo viên');
      return;
    }
    if (this.form.teachers.some(t => t.teacherId === teacherId)) {
      return; // Đã có trong danh sách
    }
    if (this.form.classType === 'OFFLINE') {
      this.form.teachers.push({
        teacherId,
        salary0: 0,
        salary1: 0,
        salary2: 0,
        salary3: 0,
        salary4: 0,
        salary5: 0,
        offlineSalary1: 0,
        offlineSalary2: 0,
        offlineSalary3: 0,
        offlineSalary4: 0,
        canCreateAttendanceLink: false,
      });
      return;
    }

    this.form.teachers.push({
      teacherId,
      salary0: 0,
      salary1: 0,
      salary2: 0,
      salary3: 0,
      salary4: 0,
      salary5: 0,
      canCreateAttendanceLink: false,
    });
  }

  removeTeacher(teacherId: string) {
    if (!this.canEditTeachers(this.form.classType)) return;
    const idx = this.form.teachers.findIndex(t => t.teacherId === teacherId);
    if (idx > -1) {
      this.form.teachers.splice(idx, 1);
    }
  }

  markAttendanceCreator(teacherId: string) {
    if (!this.canEditTeachers(this.form.classType)) return;
    this.form.teachers = this.form.teachers.map(t => ({
      ...t,
      canCreateAttendanceLink: t.teacherId === teacherId
    }));
  }

  async reload() {
    const data = await this.classService.list();
    const user = this.auth.userSignal();
    if (user?.role === 'TEACHER' && user?.sub) {
      this.classes.set(data.filter((c) => this.classHasTeacher(c, user.sub)));
      return;
    }

    this.classes.set(data);
  }

  openModal() {
    if (!this.canCreateNewClass()) return;
    this.form = this.blankForm();
    if (this.isSale()) {
      this.form.classType = 'ONLINE';
    }
    this.editingId = null;
    this.error.set('');
    this.submitLabel = 'Lưu';
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
    this.submitLabel = 'Lưu';
  }

  async submit() {
    if (!this.canManageClasses()) return;
    
    if (!this.form.classType) {
      this.error.set('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    const payload: any = {
      name: this.form.name.trim(),
      code: this.form.code.trim(),
      classType: this.form.classType as 'ONLINE' | 'OFFLINE',
      studentIds: [...this.form.studentIds],
    };

    const allowTeacherEdit = this.canEditTeachers(this.form.classType);
    if (allowTeacherEdit) {
      payload.teachers = this.form.teachers.map(t => this.buildTeacherPayload(t));
    }
    const ok = this.editingId
      ? await this.classService.update(this.editingId, payload)
      : await this.classService.create(payload);
    if (!ok) {
      this.error.set('Không thể lưu lớp học');
      return;
    }
    this.closeModal();
    this.reload();
  }

  edit(classItem: ClassItem) {
    if (!this.canManageClasses()) return;
    this.editingId = classItem._id;
    const classStudentIds = classItem.students?.map((s) => s._id) || [];
    this.form = {
      name: classItem.name,
      code: classItem.code,
      classType: classItem.classType || 'ONLINE',
      teachers: classItem.teachers?.map((t) => ({ 
        teacherId: t.teacherId._id,
        salary0: t.salary0 || 0,
        salary1: t.salary1 || 0,
        salary2: t.salary2 || 0,
        salary3: t.salary3 || 0,
        salary4: t.salary4 || 0,
        salary5: t.salary5 || 0,
        offlineSalary1: t.offlineSalary1 || 0,
        offlineSalary2: t.offlineSalary2 || 0,
        offlineSalary3: t.offlineSalary3 || 0,
        offlineSalary4: t.offlineSalary4 || 0,
        canCreateAttendanceLink: !!t.canCreateAttendanceLink,
      })) || [],
      studentIds: classStudentIds,
    };
    this.error.set('');
    this.submitLabel = 'Cập nhật';
    this.showModal.set(true);
  }

  async remove(classItem: ClassItem) {
    if (!confirm(`Xóa lớp ${classItem.name}?`)) return;
    const ok = await this.classService.remove(classItem._id);
    if (!ok) {
      alert('Không thể xóa lớp');
      return;
    }
    this.reload();
  }

  isDirector() {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }

  isTeacher() {
    return this.auth.userSignal()?.role === 'TEACHER';
  }

  isSale() {
    return this.auth.userSignal()?.role === 'SALE';
  }

  canManageClasses() {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'SALE';
  }

  private classHasTeacher(classItem: ClassItem, teacherId: string): boolean {
    return (classItem.teachers || []).some((t) => this.normalizeTeacherId(t.teacherId) === teacherId);
  }

  private normalizeTeacherId(teacher: any): string {
    return teacher?._id || teacher?.teacherId || teacher || '';
  }

  canCreateNewClass() {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'SALE';
  }

  canEditTeachers(classType: '' | 'ONLINE' | 'OFFLINE') {
    const role = this.auth.userSignal()?.role;
    if (role === 'DIRECTOR') return true;
    if (role === 'SALE') return classType === 'ONLINE';
    return false;
  }

  getTeacherName(teacherId: string): string {
    const teacher = this.teachers().find(t => t._id === teacherId);
    return teacher ? `${teacher.fullName} (${teacher.email})` : 'Không xác định';
  }

  isTeacherSelected(teacherId: string): boolean {
    return this.form.teachers.some(t => t.teacherId === teacherId);
  }

  private buildTeacherPayload(t: any) {
    if (this.form.classType === 'OFFLINE') {
      return {
        teacherId: t.teacherId,
        salary0: 0,
        salary1: 0,
        salary2: 0,
        salary3: 0,
        salary4: 0,
        salary5: 0,
        offlineSalary1: Number(t.offlineSalary1) || 0,
        offlineSalary2: Number(t.offlineSalary2) || 0,
        offlineSalary3: Number(t.offlineSalary3) || 0,
        offlineSalary4: Number(t.offlineSalary4) || 0,
        canCreateAttendanceLink: !!t.canCreateAttendanceLink,
      };
    }

    return {
      teacherId: t.teacherId,
      salary0: t.salary0,
      salary1: t.salary1,
      salary2: t.salary2,
      salary3: t.salary3,
      salary4: t.salary4,
      salary5: t.salary5,
      canCreateAttendanceLink: !!t.canCreateAttendanceLink,
    };
  }

  availableStudentList() {
    const search = this.studentSearch().trim().toLowerCase();
    const selected = new Set(this.form.studentIds);
    const user = this.auth.userSignal();
    return this.students()
      .filter((s) => this.hasConfirmedInvoice(s))
      .filter((s) => this.hasRemainingSessions(s))
      .filter((s) => {
        if (user?.role === 'SALE') {
          return s.saleId === user.sub;
        }
        return true;
      })
      .filter((s) => !selected.has(s._id))
      .filter((s) => {
        if (!search) return true;
        return (
          s.studentCode?.toLowerCase().includes(search) ||
          s.fullName?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const aTime = (a as any)?.createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const bTime = (b as any)?.createdAt ? new Date((b as any).createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  selectedStudentList() {
    const ids = new Set(this.form.studentIds);
    return this.students().filter((s) => ids.has(s._id));
  }

  addStudent(id: string) {
    if (!id) return;
    if (!this.form.studentIds.includes(id)) {
      this.form.studentIds.push(id);
    }
  }

  removeStudent(id: string) {
    this.form.studentIds = this.form.studentIds.filter((sid) => sid !== id);
  }

  isStudentSelected(id: string) {
    return this.form.studentIds.includes(id);
  }

  private hasConfirmedInvoice(student: any): boolean {
    const payments = (student?.payments as any[]) || [];
    return payments.some((p) => {
      const status = (p?.confirmStatus || '').toUpperCase();
      return p?.invoiceCode && (status === 'CONFIRMED' || status === 'APPROVED');
    });
  }

  private hasRemainingSessions(student: any): boolean {
    const bal = student?.sessionBalances;
    if (!bal) return true;
    const paid = Number.isFinite(bal.basePaid70) ? Number(bal.basePaid70) : 0;
    const used = Number.isFinite(bal.baseUsed70) ? Number(bal.baseUsed70) : 0;
    return paid - used > 0;
  }
}
