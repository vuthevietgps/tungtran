import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
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
    <button class="primary" (click)="openModal()" *ngIf="isDirector()">+ Thêm lớp học</button>
  </header>

  <table class="data" *ngIf="classes().length; else empty">
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
      <tr *ngFor="let c of classes()">
        <td>{{c.code}}</td>
        <td>{{c.name}}</td>
        <td><span class="badge" [class.badge-online]="c.classType === 'ONLINE'" [class.badge-offline]="c.classType === 'OFFLINE'">{{c.classType === 'ONLINE' ? 'Online' : 'Offline'}}</span></td>
        <td>
          <div *ngFor="let t of c.teachers" class="teacher-item">
            <span class="chip">{{t.teacherId.fullName}}</span>
          </div>
          <span *ngIf="!c.teachers?.length">—</span>
        </td>
        <td>{{c.studentCount || 0}}</td>
        <td class="actions-cell">
          <ng-container *ngIf="isDirector()">
            <button class="ghost" (click)="edit(c)">Sửa</button>
            <button class="danger" (click)="remove(c)">Xóa</button>
          </ng-container>
        </td>
      </tr>
    </tbody>
  </table>
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
          <select name="classType" [(ngModel)]="form.classType" required>
            <option value="" disabled [selected]="!form.classType">-- Chọn loại --</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </label>
        
        <div class="teacher-picker">
          <label>Giáo viên phụ trách (Tối đa 10 giáo viên)</label>
          
          <!-- Danh sách giáo viên đã chọn -->
          <div class="selected-teachers" *ngIf="form.teachers.length">
            <div *ngFor="let t of form.teachers" class="teacher-card">
              <div class="teacher-header">
                <span class="teacher-name">{{ getTeacherName(t.teacherId) }}</span>
                <button 
                  type="button" 
                  class="remove-btn" 
                  (click)="removeTeacher(t.teacherId)">×</button>
              </div>
              <ng-container *ngIf="form.classType === 'ONLINE'; else offlineSalaries">
                <div class="salaries-grid">
                  <div class="salary-input-group">
                    <label>Lương 70 phút (nhập)</label>
                    <input 
                      type="number" 
                      [(ngModel)]="t.baseSalary70" 
                      (ngModelChange)="recalcSalary(t)"
                      [ngModelOptions]="{ standalone: true }"
                      min="0" 
                      step="1000" />
                  </div>
                  <div class="salary-input-group readonly">
                    <label>40 phút</label>
                    <input type="number" [value]="t.salary0" readonly />
                  </div>
                  <div class="salary-input-group readonly">
                    <label>50 phút</label>
                    <input type="number" [value]="t.salary1" readonly />
                  </div>
                  <div class="salary-input-group readonly">
                    <label>90 phút</label>
                    <input type="number" [value]="t.salary3" readonly />
                  </div>
                  <div class="salary-input-group readonly">
                    <label>110 phút</label>
                    <input type="number" [value]="t.salary4" readonly />
                  </div>
                </div>
              </ng-container>
              <ng-template #offlineSalaries>
                <div class="offline-grid">
                  <div class="salary-input-group">
                    <label>Mức lương 1 (3 tháng đầu)</label>
                    <input type="number" [(ngModel)]="t.offlineSalary1" [ngModelOptions]="{ standalone: true }" min="0" step="50000" />
                  </div>
                  <div class="salary-input-group">
                    <label>Mức lương 2 (3 tháng tiếp theo)</label>
                    <input type="number" [(ngModel)]="t.offlineSalary2" [ngModelOptions]="{ standalone: true }" min="0" step="50000" />
                  </div>
                  <div class="salary-input-group">
                    <label>Mức lương 3 (3 tháng tiếp theo)</label>
                    <input type="number" [(ngModel)]="t.offlineSalary3" [ngModelOptions]="{ standalone: true }" min="0" step="50000" />
                  </div>
                  <div class="salary-input-group">
                    <label>Mức lương 4 (3 tháng tiếp theo)</label>
                    <input type="number" [(ngModel)]="t.offlineSalary4" [ngModelOptions]="{ standalone: true }" min="0" step="50000" />
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
            [disabled]="form.teachers.length >= 10">
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
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; color:var(--text); }
    .data { width:100%; border-collapse:collapse; background:var(--surface); color:var(--text); }
    th, td { padding:8px; border:1px solid var(--border); vertical-align:top; }
    thead { background:#132544; color:var(--muted); }
    .chip { display:inline-block; background:var(--chip); color:var(--text); padding:2px 8px; border-radius:999px; margin:0 4px 4px 0; font-size:12px; border:1px solid var(--border); }
    .badge { display:inline-block; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; border:1px solid var(--border); }
    .badge-online { background:rgba(34,211,238,0.18); color:#a5f3fc; }
    .badge-offline { background:rgba(245,158,11,0.18); color:#fcd34d; }
    .salary-level { font-weight:600; color:#22d3ee; }
    .primary { background:var(--primary); color:#04121a; border:1px solid var(--primary-strong); padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:600; }
    .ghost { border:1px solid var(--border); background:transparent; padding:6px 10px; border-radius:8px; cursor:pointer; margin-right:6px; color:var(--text); }
    .danger { border:1px solid var(--danger); background:var(--danger); color:#fff; padding:6px 10px; border-radius:8px; cursor:pointer; }
    .ghost:hover, .danger:hover { opacity:.9; }
    select, input { padding:8px 10px; border:1px solid var(--border); border-radius:8px; width:100%; background:var(--panel); color:var(--text); }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { white-space:nowrap; width:140px; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(4,12,30,.75); display:flex; align-items:center; justify-content:center; }
    .modal { background:var(--surface); padding:20px; border-radius:12px; width:420px; max-height:90vh; overflow:auto; box-shadow:0 20px 50px rgba(0,0,0,0.55); border:1px solid var(--border); color:var(--text); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .error { color:#dc2626; }
    .teacher-picker { margin-bottom:12px; }
    .teacher-picker > label { display:block; font-weight:500; margin-bottom:8px; }
    .teacher-item { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
    .selected-teachers { margin-bottom:12px; }
    .teacher-card { background:rgba(12,24,46,0.9); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px; color:var(--text); }
    .teacher-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
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
  `]
})
export class ClassesComponent {
  classes = signal<ClassItem[]>([]);
  teachers = signal<UserItem[]>([]);
  showModal = signal(false);
  error = signal('');
  editingId: string | null = null;
  form = this.blankForm();
  submitLabel = 'Lưu';

  constructor(
    private classService: ClassService,
    private userService: UserService,
    private auth: AuthService,
  ) {
    this.loadTeachers();
    this.reload();
  }

  blankForm() {
    return { 
      name: '', 
      code: '', 
      classType: '' as '' | 'ONLINE' | 'OFFLINE',
      teachers: [] as { teacherId: string; baseSalary70: number; salary0: number; salary1: number; salary2: number; salary3: number; salary4: number; salary5: number; offlineSalary1?: number; offlineSalary2?: number; offlineSalary3?: number; offlineSalary4?: number }[], 
      studentIds: [] as string[]
    };
  }

  async loadTeachers() {
    const users = await this.userService.list();
    this.teachers.set(users.filter((u) => u.role === 'TEACHER'));
  }

  addTeacher(teacherId: string) {
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
        baseSalary70: 0,
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
      });
      return;
    }

    const baseSalary70 = 0;
    const computed = this.computeSalaries(baseSalary70);
    this.form.teachers.push({ teacherId, baseSalary70, ...computed });
  }

  removeTeacher(teacherId: string) {
    const idx = this.form.teachers.findIndex(t => t.teacherId === teacherId);
    if (idx > -1) {
      this.form.teachers.splice(idx, 1);
    }
  }

  async reload() {
    const data = await this.classService.list();
    this.classes.set(data);
  }

  openModal() {
    if (!this.isDirector()) return;
    this.form = this.blankForm();
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
    if (!this.isDirector()) return;
    
    if (!this.form.classType) {
      this.error.set('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    const payload = {
      name: this.form.name.trim(),
      code: this.form.code.trim(),
      classType: this.form.classType as 'ONLINE' | 'OFFLINE',
      teachers: this.form.teachers.map(t => this.buildTeacherPayload(t)),
      studentIds: [...this.form.studentIds],
    };
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
    if (!this.isDirector()) return;
    this.editingId = classItem._id;
    const classStudentIds = classItem.students?.map((s) => s._id) || [];
    this.form = {
      name: classItem.name,
      code: classItem.code,
      classType: classItem.classType || 'ONLINE',
      teachers: classItem.teachers?.map((t) => ({ 
        teacherId: t.teacherId._id, 
        baseSalary70: t.salary2,
        ...this.computeSalaries(t.salary2),
        offlineSalary1: t.offlineSalary1 || 0,
        offlineSalary2: t.offlineSalary2 || 0,
        offlineSalary3: t.offlineSalary3 || 0,
        offlineSalary4: t.offlineSalary4 || 0,
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

  getTeacherName(teacherId: string): string {
    const teacher = this.teachers().find(t => t._id === teacherId);
    return teacher ? `${teacher.fullName} (${teacher.email})` : 'Không xác định';
  }

  isTeacherSelected(teacherId: string): boolean {
    return this.form.teachers.some(t => t.teacherId === teacherId);
  }

  recalcSalary(t: any) {
    if (this.form.classType !== 'ONLINE') return;
    const computed = this.computeSalaries(t.baseSalary70);
    Object.assign(t, computed);
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
      baseSalary70: t.baseSalary70,
    };
  }

  private computeSalaries(baseSalary70: number) {
    const base = Math.max(0, Number(baseSalary70) || 0);
    const calc = (minutes: number) => Math.round((base * minutes) / 70);
    return {
      salary0: calc(40),
      salary1: calc(50),
      salary2: base,
      salary3: calc(90),
      salary4: calc(110),
      salary5: calc(70),
    };
  }
}
