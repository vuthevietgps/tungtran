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
        <th>Giáo viên</th>
        <th>Sale</th>
        <th>Học viên</th>
        <th>Hành động</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let c of classes()">
        <td>{{c.code}}</td>
        <td>{{c.name}}</td>
        <td>{{c.teacher?.fullName || '—'}}</td>
        <td>{{c.sale?.fullName || '—'}}</td>
        <td>
          <span class="chip" *ngFor="let s of c.students">{{s.fullName}}</span>
          <span *ngIf="!c.students?.length">Chưa có</span>
        </td>
        <td class="actions-cell">
          <ng-container *ngIf="isDirector(); else saleActions">
            <button class="ghost" (click)="edit(c)">Sửa</button>
            <button class="danger" (click)="remove(c)">Xóa</button>
          </ng-container>
          <ng-template #saleActions>
            <button class="ghost" *ngIf="canSaleAssign(c)" (click)="edit(c)">Chọn học viên</button>
          </ng-template>
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
          <input name="name" [(ngModel)]="form.name" required [readonly]="isSale()" />
        </label>
        <label>Mã lớp
          <input name="code" [(ngModel)]="form.code" required [readonly]="isSale()" />
        </label>
        <label>Giáo viên phụ trách
          <select name="teacherId" [(ngModel)]="form.teacherId" required [disabled]="isSale()">
            <option value="" disabled [selected]="!form.teacherId">-- Chọn giáo viên --</option>
            <option *ngFor="let t of teachers()" [value]="t._id">{{t.fullName}} ({{t.email}})</option>
          </select>
        </label>
        <label>Nhân viên Sale
          <select name="saleId" [(ngModel)]="form.saleId" required [disabled]="isSale()">
            <option value="" disabled [selected]="!form.saleId">-- Chọn Sale --</option>
            <option *ngFor="let s of sales()" [value]="s._id">{{s.fullName}} ({{s.email}})</option>
          </select>
        </label>
        <section class="student-picker">
          <div class="student-column">
            <div class="column-header">
              <strong>Danh sách học viên</strong>
              <input [(ngModel)]="studentSearch" placeholder="Tìm kiếm học viên" name="studentSearch" />
            </div>
            <div class="student-list">
              <div class="student-row" *ngFor="let st of availableStudents()">
                <span>{{st.fullName}}</span>
                <button type="button" (click)="addStudent(st)">Thêm</button>
              </div>
              <p *ngIf="!availableStudents().length" class="muted">Không tìm thấy học viên phù hợp</p>
            </div>
          </div>
          <div class="student-column">
            <div class="column-header">
              <strong>Học viên trong lớp</strong>
            </div>
            <div class="student-list">
              <div class="student-row" *ngFor="let st of selectedStudents()">
                <span>{{st.fullName}}</span>
                <button type="button" class="remove" (click)="removeStudent(st._id)">✕</button>
              </div>
              <p *ngIf="!selectedStudents().length" class="muted">Chưa chọn học viên nào</p>
            </div>
          </div>
        </section>
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
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .data { width:100%; border-collapse:collapse; background:#fff; }
    th, td { padding:8px; border:1px solid #e2e8f0; vertical-align:top; }
    thead { background:#f1f5f9; }
    .chip { display:inline-block; background:#e0f2fe; color:#0f172a; padding:2px 8px; border-radius:999px; margin:0 4px 4px 0; font-size:12px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:4px 10px; border-radius:4px; cursor:pointer; margin-right:6px; }
    .danger { border:1px solid #dc2626; background:#dc2626; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; }
    .ghost:hover, .danger:hover { opacity:.85; }
    select, input { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; width:100%; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { white-space:nowrap; width:140px; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:420px; max-height:90vh; overflow:auto; box-shadow:0 12px 32px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .error { color:#dc2626; }
    .student-picker { display:flex; gap:16px; }
    .student-column { flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:10px; background:#f8fafc; }
    .column-header { display:flex; flex-direction:column; gap:6px; margin-bottom:8px; }
    .student-list { max-height:200px; overflow:auto; background:#fff; border:1px solid #e2e8f0; border-radius:6px; }
    .student-row { display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #f1f5f9; font-size:14px; }
    .student-row:last-child { border-bottom:none; }
    .student-row button { border:1px solid #2563eb; background:#2563eb; color:#fff; border-radius:4px; padding:4px 10px; cursor:pointer; }
    .student-row button.remove { background:#dc2626; border-color:#dc2626; }
    .muted { text-align:center; padding:12px; color:#94a3b8; font-size:13px; margin:0; }
  `]
})
export class ClassesComponent {
  classes = signal<ClassItem[]>([]);
  teachers = signal<UserItem[]>([]);
  sales = signal<UserItem[]>([]);
  students = signal<StudentItem[]>([]);
  studentSearch = '';
  showModal = signal(false);
  error = signal('');
  editingId: string | null = null;
  form = this.blankForm();
  submitLabel = 'Lưu';

  constructor(
    private classService: ClassService,
    private userService: UserService,
    private studentService: StudentService,
    private auth: AuthService,
  ) {
    this.loadLookups();
    this.reload();
  }

  blankForm() {
    return { name: '', code: '', teacherId: '', saleId: '', studentIds: [] as string[] };
  }

  async loadLookups() {
    const [users, studs] = await Promise.all([this.userService.list(), this.studentService.list()]);
    this.teachers.set(users.filter((u) => u.role === 'TEACHER'));
    this.sales.set(users.filter((u) => u.role === 'SALE'));
    this.students.set(studs);
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
    this.studentSearch = '';
    this.submitLabel = 'Lưu';
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
    this.submitLabel = 'Lưu';
  }

  async submit() {
    if (this.isSale()) {
      if (!this.editingId) return;
      if (!this.form.studentIds.length) {
        this.error.set('Vui lòng chọn ít nhất một học viên');
        return;
      }
      const okSale = await this.classService.assignStudents(this.editingId, this.form.studentIds);
      if (!okSale) {
        this.error.set('Không thể thêm học viên');
        return;
      }
      this.closeModal();
      this.reload();
      return;
    }

    if (!this.form.teacherId || !this.form.saleId) {
      this.error.set('Vui lòng chọn giáo viên và Sale');
      return;
    }
    const payload = {
      name: this.form.name.trim(),
      code: this.form.code.trim(),
      teacherId: this.form.teacherId,
      saleId: this.form.saleId,
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
    if (this.isSale() && !this.canSaleAssign(classItem)) return;
    this.editingId = classItem._id;
    const classStudentIds = classItem.students?.map((s) => s._id) || [];
    const myStudents = new Set(this.students().map((s) => s._id));
    this.form = {
      name: classItem.name,
      code: classItem.code,
      teacherId: classItem.teacher?._id || '',
      saleId: classItem.sale?._id || '',
      studentIds: this.isSale() ? classStudentIds.filter((id) => myStudents.has(id)) : classStudentIds,
    };
    this.error.set('');
    this.studentSearch = '';
    this.submitLabel = this.isSale() ? 'Thêm học viên' : 'Cập nhật';
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

  availableStudents(): StudentItem[] {
    const query = this.studentSearch.trim().toLowerCase();
    const selectedSet = new Set(this.form.studentIds);
    return this.students().filter((st) => {
      const matches = !query || st.fullName.toLowerCase().includes(query);
      return matches && !selectedSet.has(st._id);
    });
  }

  selectedStudents(): StudentItem[] {
    const selectedSet = new Set(this.form.studentIds);
    return this.students().filter((st) => selectedSet.has(st._id));
  }

  addStudent(student: StudentItem) {
    if (this.form.studentIds.includes(student._id)) return;
    this.form.studentIds = [...this.form.studentIds, student._id];
  }

  removeStudent(id: string) {
    this.form.studentIds = this.form.studentIds.filter((sid) => sid !== id);
  }

  isDirector() {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }

  isSale() {
    return this.auth.userSignal()?.role === 'SALE';
  }

  canSaleAssign(classItem: ClassItem) {
    const current = this.auth.userSignal();
    return current?.role === 'SALE' && classItem.sale?._id === current.sub;
  }
}
