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
      <p>Tạo lớp, chỉ định giáo viên & học viên, thiết lập giá/buổi và lương/buổi.</p>
    </div>
    <button class="primary" (click)="openModal()" *ngIf="canManage()">+ Thêm lớp học</button>
  </header>

  <table class="data" *ngIf="classes().length; else empty">
    <thead>
      <tr>
        <th>Mã lớp</th>
        <th>Tên lớp</th>
        <th>Giáo viên</th>
        <th>Học viên</th>
        <th>Giá cơ sở (HS)</th>
        <th>Lương cơ sở (GV)</th>
        <th>TL cơ sở</th>
        <th>TL buổi học</th>
        <th>Giá thực/buổi</th>
        <th>Lương thực/buổi</th>
        <th>Lợi nhuận/buổi</th>
        <th>Hành động</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let c of classes()">
        <td>{{c.code}}</td>
        <td>{{c.name}}</td>
        <td>{{c.teacher?.fullName || '—'}}</td>
        <td>
          <span class="chip" *ngFor="let s of c.students">{{s.fullName}}</span>
          <span *ngIf="!c.students?.length">Chưa có</span>
        </td>
        <td>{{formatCurrency(c.pricePerSession)}}</td>
        <td>{{formatCurrency(c.teacherPayPerSession)}}</td>
        <td>{{c.baseDuration || 60}}p</td>
        <td>{{c.sessionDuration || 60}}p</td>
        <td><strong>{{formatCurrency(c.actualPricePerSession ?? c.pricePerSession)}}</strong></td>
        <td>{{formatCurrency(c.actualTeacherPayPerSession ?? c.teacherPayPerSession)}}</td>
        <td [class]="getProfitClass(getProfit(c))">
          {{formatCurrency(getProfit(c))}}
        </td>
        <td class="actions-cell">
          <ng-container *ngIf="canManage()">
            <button class="ghost" (click)="edit(c)">Sửa</button>
            <button class="danger" (click)="remove(c)" *ngIf="isDirector()">Xóa</button>
          </ng-container>
          <ng-container *ngIf="isSale() && canSaleAssign(c)">
            <button class="ghost" (click)="edit(c)">Chọn học viên</button>
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
        <label *ngIf="!isOps()">Nhân viên Sale (tùy chọn)
          <select name="saleId" [(ngModel)]="form.saleId" [disabled]="isSale()">
            <option value="">-- Không chọn --</option>
            <option *ngFor="let s of sales()" [value]="s._id">{{s.fullName}} ({{s.email}})</option>
          </select>
        </label>
        
        <div class="financial-info" *ngIf="canManage()">
          <h4>💰 Thiết lập giá theo buổi</h4>
          <div class="pricing-grid">
            <label>Giá thu HS / buổi (VNĐ)
              <input name="pricePerSession" [(ngModel)]="form.pricePerSession" type="number" min="0" step="10000" />
            </label>
            <label>Lương GV / buổi (VNĐ)
              <input name="teacherPayPerSession" [(ngModel)]="form.teacherPayPerSession" type="number" min="0" step="10000" />
            </label>
            <label>Thời lượng cơ sở (phút)
              <select name="baseDuration" [(ngModel)]="form.baseDuration">
                <option *ngFor="let d of standardDurations" [ngValue]="d">{{d}} phút</option>
              </select>
            </label>
            <label>Thời lượng buổi học (phút)
              <input name="sessionDuration" [(ngModel)]="form.sessionDuration" type="number" min="15" step="5" />
            </label>
          </div>

          <div class="price-reference" *ngIf="form.pricePerSession">
            <h5>📊 Bảng giá tham chiếu theo thời lượng</h5>
            <table class="ref-table">
              <thead><tr><th>Thời lượng</th><th>Học phí HS</th><th>Lương GV</th><th>Lợi nhuận</th></tr></thead>
              <tbody>
                <tr *ngFor="let d of standardDurations" [class.active-row]="d === form.sessionDuration">
                  <td>{{d}} phút <span class="badge" *ngIf="d === form.baseDuration">cơ sở</span></td>
                  <td>{{formatCurrency(calcProportional(form.pricePerSession, d))}}</td>
                  <td>{{formatCurrency(calcProportional(form.teacherPayPerSession, d))}}</td>
                  <td [class]="getProfitClass(calcProportional(form.pricePerSession, d) - calcProportional(form.teacherPayPerSession, d))">
                    {{formatCurrency(calcProportional(form.pricePerSession, d) - calcProportional(form.teacherPayPerSession, d))}}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="financial-summary" *ngIf="form.pricePerSession || form.teacherPayPerSession">
            <p><strong>Số học viên:</strong> {{selectedStudents().length}}</p>
            <p><strong>Giá cơ sở ({{form.baseDuration}}p):</strong> {{formatCurrency(form.pricePerSession)}}</p>
            <p><strong>Giá thực tế ({{form.sessionDuration}}p):</strong> {{formatCurrency(calcProportional(form.pricePerSession, form.sessionDuration))}}</p>
            <p><strong>Lương GV thực tế ({{form.sessionDuration}}p):</strong> {{formatCurrency(calcProportional(form.teacherPayPerSession, form.sessionDuration))}}</p>
            <p [class]="getProfitClass(calcProportional(form.pricePerSession, form.sessionDuration) - calcProportional(form.teacherPayPerSession, form.sessionDuration))">
              <strong>Lợi nhuận/buổi:</strong> {{formatCurrency(calcProportional(form.pricePerSession, form.sessionDuration) - calcProportional(form.teacherPayPerSession, form.sessionDuration))}}
            </p>
          </div>
        </div>
        
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
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:520px; max-height:90vh; overflow:auto; box-shadow:0 12px 32px rgba(15,23,42,.2); }
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
    .financial-info { border-top:1px solid #e2e8f0; padding-top:16px; margin-top:8px; }
    .financial-info h4 { margin:0 0 12px 0; color:#334155; }
    .pricing-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; }
    .ref-table { width:100%; margin-top:8px; border-collapse:collapse; font-size:13px; }
    .ref-table th, .ref-table td { padding:6px 10px; border:1px solid #e2e8f0; text-align:right; }
    .ref-table th { background:#f1f5f9; text-align:center; font-weight:600; }
    .ref-table td:first-child { text-align:left; }
    .ref-table .active-row { background:#eff6ff; font-weight:600; }
    .price-reference { margin-top:12px; }
    .price-reference h5 { margin:0 0 8px 0; color:#334155; font-size:14px; }
    .badge { display:inline-block; background:#2563eb; color:#fff; font-size:10px; padding:1px 6px; border-radius:99px; margin-left:4px; font-weight:500; }
    .financial-summary { background:#f1f5f9; padding:12px; border-radius:6px; margin-top:12px; }
    .financial-summary p { margin:4px 0; font-size:14px; }
    .profit-positive { color:#059669; font-weight:600; }
    .profit-negative { color:#dc2626; font-weight:600; }
    .profit-zero { color:#6b7280; }
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
  standardDurations = [30, 40, 50, 60, 70, 80, 90, 120];

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
    return { 
      name: '', 
      code: '', 
      teacherId: '', 
      saleId: '', 
      studentIds: [] as string[],
      pricePerSession: 0,
      teacherPayPerSession: 0,
      baseDuration: 60,
      sessionDuration: 60,
      revenuePerStudent: 0,
      teacherSalaryCost: 0
    };
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
    if (!this.canManage()) return;
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

    if (!this.form.teacherId) {
      this.error.set('Vui lòng chọn giáo viên');
      return;
    }
    const payload = {
      name: this.form.name.trim(),
      code: this.form.code.trim(),
      teacherId: this.form.teacherId,
      saleId: this.form.saleId || undefined,
      studentIds: [...this.form.studentIds],
      pricePerSession: this.form.pricePerSession || 0,
      teacherPayPerSession: this.form.teacherPayPerSession || 0,
      baseDuration: this.form.baseDuration || 60,
      sessionDuration: this.form.sessionDuration || 60,
      revenuePerStudent: this.form.revenuePerStudent || 0,
      teacherSalaryCost: this.form.teacherSalaryCost || 0,
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
      pricePerSession: classItem.pricePerSession || 0,
      teacherPayPerSession: classItem.teacherPayPerSession || 0,
      baseDuration: classItem.baseDuration || 60,
      sessionDuration: classItem.sessionDuration || 60,
      revenuePerStudent: classItem.revenuePerStudent || 0,
      teacherSalaryCost: classItem.teacherSalaryCost || 0,
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

  isOps() {
    return this.auth.userSignal()?.role === 'OPS';
  }

  isSale() {
    return this.auth.userSignal()?.role === 'SALE';
  }

  canManage() {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS';
  }

  canSaleAssign(classItem: ClassItem) {
    const current = this.auth.userSignal();
    return current?.role === 'SALE' && classItem.sale?._id === current.sub;
  }

  formatCurrency(amount?: number): string {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  getProfitClass(profit?: number): string {
    if (!profit && profit !== 0) return '';
    if (profit > 0) return 'profit-positive';
    if (profit < 0) return 'profit-negative';
    return 'profit-zero';
  }

  /** Tính giá tỷ lệ theo thời lượng */
  calcProportional(basePrice: number | undefined, targetDuration: number): number {
    if (!basePrice) return 0;
    const base = this.form.baseDuration || 60;
    return Math.round(basePrice * (targetDuration / base));
  }

  /** Lợi nhuận thực tế (sau tỷ lệ) của 1 lớp */
  getProfit(c: ClassItem): number {
    const price = c.actualPricePerSession ?? c.pricePerSession ?? 0;
    const pay = c.actualTeacherPayPerSession ?? c.teacherPayPerSession ?? 0;
    return price - pay;
  }
}
