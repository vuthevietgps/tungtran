import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderItem, OrderPayload, OrderService, OrderSessionEntry } from '../services/order.service';
import { UserItem, UserService } from '../services/user.service';
import { ClassItem, ClassService } from '../services/class.service';
import { StudentItem, StudentService } from '../services/student.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="orders-screen">
      <header class="control-bar">
        <div class="control-actions">
          <button type="button" class="primary" (click)="startCreate()" [disabled]="isEditing()">+ Thêm đơn hàng</button>
          <button type="button" class="ghost" (click)="reload()" [disabled]="isEditing()">Làm mới</button>
          <button type="button" class="ghost" disabled title="Tính năng sắp ra mắt">Tải CSV</button>
        </div>
        <div class="control-stats">
          <span class="badge badge-total">Tổng: {{ orders().length }}</span>
          <span class="badge badge-active">Đang hiển thị: {{ filtered().length }}</span>
        </div>
      </header>

      <section class="filters-panel">
        <div class="filter">
          <label>Từ khóa</label>
          <input class="search-input" placeholder="Tìm học sinh, phụ huynh hoặc sale" [ngModel]="keyword()" (ngModelChange)="keyword.set($event)" />
        </div>
        <div class="filter">
          <label>Giáo viên</label>
          <select class="filter-select" [ngModel]="teacherFilter()" (ngModelChange)="teacherFilter.set($event)">
            <option value="">Tất cả</option>
            <option *ngFor="let teacher of teachers()" [value]="teacher._id">{{ teacher.fullName }}</option>
          </select>
        </div>
        <div class="filter">
          <label>Lớp học</label>
          <select class="filter-select" [ngModel]="classFilter()" (ngModelChange)="classFilter.set($event)">
            <option value="">Tất cả</option>
            <option *ngFor="let classroom of classes()" [value]="classroom._id">{{ classroom.code }} - {{ classroom.name }}</option>
          </select>
        </div>
        <div class="filter actions">
          <button type="button" class="ghost" (click)="resetFilters()">Đặt lại</button>
        </div>
      </section>

      <section class="table-area">
        <ng-container *ngIf="filtered().length || isCreating(); else empty">
          <div class="table-scroll">
            <table class="orders-table">
              <thead>
                <tr>
                  <th>Mã HS</th>
                  <th class="col-student">Tên HS</th>
                  <th>Level</th>
                  <th>Tên PH</th>
                  <th>Giáo viên</th>
                  <th>Mã GV</th>
                  <th>Email GV</th>
                  <th>Lương GV</th>
                  <th>Sale</th>
                  <th>Email Sale</th>
                  <th>Mã lớp</th>
                  <th>Số hóa đơn</th>
                  <th>Số buổi theo hóa đơn</th>
                  <th>Tình trạng data</th>
                  <th>Học thử/Buổi tặng</th>
                  <th *ngFor="let col of sessionColumns">Buổi {{ col }}</th>
                  <th>Tổng số buổi học đã điểm danh</th>
                  <th>Lương giáo viên được nhận</th>
                  <th>Trạng thái thanh toán</th>
                  <th>Mã hóa đơn thanh toán</th>
                  <th>Ảnh chứng từ</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngIf="isCreating()">
                  <ng-container *ngTemplateOutlet="editRow; context: { order: null, isNew: true }"></ng-container>
                </tr>
                <tr *ngFor="let order of filtered()">
                  <ng-container *ngIf="isEditing(order._id); else viewRow">
                    <ng-container *ngTemplateOutlet="editRow; context: { order: order, isNew: false }"></ng-container>
                  </ng-container>
                  <ng-template #viewRow>
                    <td class="cell code">{{ order.studentCode }}</td>
                    <td class="cell student">{{ order.studentName }}</td>
                    <td class="cell level">{{ order.level || '-' }}</td>
                    <td class="cell parent">{{ order.parentName }}</td>
                    <td class="cell teacher">{{ order.teacherName || '-' }}</td>
                    <td class="cell teacher-code">{{ order.teacherCode || '-' }}</td>
                    <td class="cell teacher-email">{{ order.teacherEmail || '-' }}</td>
                    <td class="cell teacher-salary">{{ order.teacherSalary != null ? (order.teacherSalary | number:'1.0-0') : '-' }}</td>
                    <td class="cell sale">{{ order.saleName || '-' }}</td>
                    <td class="cell sale-email">{{ order.saleEmail || '-' }}</td>
                    <td class="cell class-code">{{ order.classCode || '-' }}</td>
                    <td class="cell invoice">{{ order.invoiceNumber || '-' }}</td>
                    <td class="cell sessions">{{ order.sessionsByInvoice ?? '-' }}</td>
                    <td class="cell data-status">{{ order.dataStatus || '-' }}</td>
                    <td class="cell gift">{{ order.trialOrGift || '-' }}</td>
                    <td *ngFor="let col of sessionColumns" class="cell session" [class.filled]="sessionCell(order, col)">
                      <ng-container *ngIf="sessionCell(order, col) as session; else emptyCell">
                        <div class="session-details">
                          <div><span class="label">Mã điểm danh:</span><span>{{ generateAttendanceCode(order.studentCode, order.teacherCode, session.date, col) }}</span></div>
                          <div><span class="label">Học sinh:</span><span>{{ order.studentName }}</span></div>
                          <div><span class="label">Lớp:</span><span>{{ order.classCode || '-' }}</span></div>
                          <div><span class="label">Giáo viên:</span><span>{{ order.teacherName || '-' }}</span></div>
                          <div><span class="label">Ngày:</span><span>{{ formatDate(session.date) || '-' }}</span></div>
                          <div *ngIf="session.attendedAt"><span class="label">Điểm danh:</span><span>{{ formatDateTime(session.attendedAt) }}</span></div>
                        </div>
                        <div class="session-actions">
                          <a *ngIf="session.lookupUrl" [href]="session.lookupUrl" target="_blank">Xem</a>
                          <a *ngIf="session.imageUrl" [href]="imageUrl(session.imageUrl)" target="_blank">Ảnh</a>
                        </div>
                      </ng-container>
                    </td>
                    <td class="cell total-sessions">{{ order.totalAttendedSessions ?? '-' }}</td>
                    <td class="cell earned-salary">{{ order.teacherEarnedSalary != null ? (order.teacherEarnedSalary | number:'1.0-0') : '-' }}</td>
                    <td class="cell payment-status">{{ order.paymentStatus || '-' }}</td>
                    <td class="cell payment-invoice">{{ order.paymentInvoiceCode || '-' }}</td>
                    <td class="cell payment-proof">
                      <a *ngIf="order.paymentProofImage" [href]="imageUrl(order.paymentProofImage)" target="_blank">Xem ảnh</a>
                      <span *ngIf="!order.paymentProofImage">-</span>
                    </td>
                    <td class="cell status" [class.active]="order.status === 'Đang hoạt động'" [class.locked]="order.status === 'Đã khóa'">{{ order.status || 'Đang hoạt động' }}</td>
                    <td class="cell actions">
                      <button *ngIf="order.status !== 'Đã khóa'" class="ghost" (click)="startEdit(order)" [disabled]="isEditing()">Sửa</button>
                      <button *ngIf="order.status !== 'Đã khóa'" class="ghost danger" (click)="remove(order)" [disabled]="isEditing()">Xóa</button>
                      <span *ngIf="order.status === 'Đã khóa'" class="locked-message">Đã khóa</span>
                    </td>
                  </ng-template>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>
      </section>
    </div>

    <ng-template #empty>
      <div class="empty-state">
        <p>Chưa có đơn hàng.</p>
        <button type="button" class="primary" (click)="startCreate()" [disabled]="isEditing()">+ Tạo đơn đầu tiên</button>
      </div>
    </ng-template>

    <ng-template #emptyCell><span>-</span></ng-template>

    <ng-template #editRow let-order="order" let-isNew="isNew">
      <td class="cell code editing">
        <select [(ngModel)]="form.studentCode" (ngModelChange)="handleStudentCodeChange($event)" [ngModelOptions]="{ standalone: true }">
          <option value="">-- Chọn mã học sinh --</option>
          <option *ngFor="let student of students()" [value]="student.studentCode">{{ student.studentCode }}</option>
        </select>
      </td>
      <td class="cell student editing">
        <input placeholder="Tên học sinh" [(ngModel)]="form.studentName" [ngModelOptions]="{ standalone: true }" [disabled]="true" />
      </td>
      <td class="cell level editing">
        <input [(ngModel)]="form.level" [ngModelOptions]="{ standalone: true }" />
      </td>
      <td class="cell parent editing">
        <input [(ngModel)]="form.parentName" [ngModelOptions]="{ standalone: true }" />
      </td>
      <td class="cell teacher editing">
        <select [(ngModel)]="form.teacherId" (ngModelChange)="handleTeacherChange($event)" [ngModelOptions]="{ standalone: true }">
          <option value="">-- Chọn giáo viên --</option>
          <option *ngFor="let teacher of teachers()" [value]="teacher._id">{{ teacher.fullName }}</option>
          <option value="__new__">+ Thêm giáo viên mới</option>
        </select>
      </td>
      <td class="cell teacher-code editing">
        <input 
          [(ngModel)]="form.teacherCode" 
          [ngModelOptions]="{ standalone: true }" 
          [disabled]="form.teacherId && form.teacherId !== '__new__'"
        />
      </td>
      <td class="cell teacher-email editing">
        <input 
          [(ngModel)]="form.teacherEmail" 
          [ngModelOptions]="{ standalone: true }" 
          [disabled]="form.teacherId && form.teacherId !== '__new__'"
        />
      </td>
      <td class="cell teacher-salary editing">
        <input type="number" min="0" step="10000" [(ngModel)]="form.teacherSalary" [ngModelOptions]="{ standalone: true }" />
      </td>
      <td class="cell sale editing">
        <input placeholder="Tên sale" [(ngModel)]="form.saleName" [ngModelOptions]="{ standalone: true }" [disabled]="true" />
      </td>
      <td class="cell sale-email editing">
        <input [(ngModel)]="form.saleEmail" [ngModelOptions]="{ standalone: true }" [disabled]="true" />
      </td>
      <td class="cell class-code editing">
        <select [(ngModel)]="form.classId" (ngModelChange)="handleClassChange($event)" [ngModelOptions]="{ standalone: true }">
          <option value="">-- Chọn lớp học --</option>
          <option *ngFor="let classroom of classes()" [value]="classroom._id">{{ classroom.name }} ({{ classroom.code }})</option>
          <option value="__new__">+ Thêm mã lớp mới</option>
        </select>
        <input 
          class="compact" 
          placeholder="Mã lớp" 
          [(ngModel)]="form.classCode" 
          (ngModelChange)="handleClassCodeChange($event)"
          [ngModelOptions]="{ standalone: true }" 
          [disabled]="form.classId && form.classId !== '__new__'"
        />
      </td>
      <td class="cell invoice editing">
        <select [(ngModel)]="form.invoiceNumber" (ngModelChange)="handleInvoiceChange($event)" [ngModelOptions]="{ standalone: true }">
          <option value="">-- Chọn hóa đơn --</option>
          <option *ngFor="let invoice of availableInvoices()" [value]="invoice.code">{{ invoice.code }}</option>
        </select>
      </td>
      <td class="cell sessions editing">
        <input type="number" min="0" [(ngModel)]="form.sessionsByInvoice" [ngModelOptions]="{ standalone: true }" [disabled]="true" />
      </td>
      <td class="cell data-status editing">
        <input [(ngModel)]="form.dataStatus" [ngModelOptions]="{ standalone: true }" />
      </td>
      <td class="cell gift editing">
        <input [(ngModel)]="form.trialOrGift" [ngModelOptions]="{ standalone: true }" />
      </td>
      <td *ngFor="let col of sessionColumns" class="cell session editing" [class.filled]="sessionCell(order, col)">
        <ng-container *ngIf="sessionCell(order, col) as session; else emptyCell">
          <div class="session-details">
            <div><span class="label">Mã điểm danh:</span><span>{{ generateAttendanceCode(form.studentCode || order?.studentCode, form.teacherCode || order?.teacherCode, session.date, col) }}</span></div>
            <div><span class="label">Học sinh:</span><span>{{ form.studentName || order?.studentName }}</span></div>
            <div><span class="label">Lớp:</span><span>{{ form.classCode || order?.classCode || '-' }}</span></div>
            <div><span class="label">Giáo viên:</span><span>{{ form.teacherName || order?.teacherName || '-' }}</span></div>
            <div><span class="label">Ngày:</span><span>{{ formatDate(session.date) || '-' }}</span></div>
            <div *ngIf="session.attendedAt"><span class="label">Điểm danh:</span><span>{{ formatDateTime(session.attendedAt) }}</span></div>
          </div>
          <div class="session-actions">
            <a *ngIf="session.lookupUrl" [href]="session.lookupUrl" target="_blank">Xem</a>
            <a *ngIf="session.imageUrl" [href]="imageUrl(session.imageUrl)" target="_blank">Ảnh</a>
          </div>
        </ng-container>
      </td>
      <td class="cell total-sessions editing">
        <span>{{ order?.totalAttendedSessions ?? '-' }}</span>
      </td>
      <td class="cell earned-salary editing">
        <span>{{ order?.teacherEarnedSalary != null ? (order.teacherEarnedSalary | number:'1.0-0') : '-' }}</span>
      </td>
      <td class="cell payment-status editing">
        <select [(ngModel)]="form.paymentStatus" [ngModelOptions]="{ standalone: true }">
          <option value="">-- Chọn trạng thái --</option>
          <option value="Yêu cầu thanh toán">Yêu cầu thanh toán</option>
          <option value="Duyệt thanh toán">Duyệt thanh toán</option>
          <option value="Đã thanh toán">Đã thanh toán</option>
        </select>
      </td>
      <td class="cell payment-invoice editing">
        <input placeholder="Mã hóa đơn thanh toán" [(ngModel)]="form.paymentInvoiceCode" [ngModelOptions]="{ standalone: true }" />
      </td>
      <td class="cell payment-proof editing">
        <input placeholder="URL ảnh chứng từ" [(ngModel)]="form.paymentProofImage" [ngModelOptions]="{ standalone: true }" />
        <a *ngIf="form.paymentProofImage" [href]="imageUrl(form.paymentProofImage)" target="_blank" class="preview-link">Xem</a>
      </td>
      <td class="cell status editing">
        <select [(ngModel)]="form.status" [ngModelOptions]="{ standalone: true }">
          <option value="Đang hoạt động">Đang hoạt động</option>
          <option value="Đã khóa">Đã khóa</option>
        </select>
      </td>
      <td class="cell actions editing">
        <button class="primary" type="button" (click)="save()">{{ isNew ? 'Tạo đơn' : 'Lưu' }}</button>
        <button class="ghost" type="button" (click)="cancel()">Hủy</button>
        <div class="error" *ngIf="error()">{{ error() }}</div>
      </td>
    </ng-template>
  `,
  styles: [`
    :host { display:block; color:#e2e8f0; }
    .orders-screen { display:flex; flex-direction:column; gap:18px; }
    .control-bar { display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,#061432,#0b1f47); padding:18px 24px; border-radius:16px; box-shadow:0 18px 45px rgba(4,12,30,0.55); }
    .control-actions { display:flex; gap:12px; align-items:center; }
    .control-stats { display:flex; gap:10px; align-items:center; }
    .badge { padding:6px 12px; border-radius:999px; font-size:13px; font-weight:600; letter-spacing:0.02em; }
    .badge-total { background:rgba(37,99,235,0.18); color:#93c5fd; }
    .badge-active { background:rgba(16,185,129,0.2); color:#6ee7b7; }
    .filters-panel { display:grid; grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(180px, 240px)) auto; gap:16px; align-items:end; background:linear-gradient(135deg,#081734,#102544); padding:16px 20px; border-radius:16px; box-shadow:0 14px 32px rgba(7,16,36,0.5); }
    .filter { display:flex; flex-direction:column; gap:6px; color:#cbd5f5; font-size:13px; }
    .filter.actions { align-items:flex-end; }
    .search-input, .filter-select { width:100%; padding:10px 12px; border-radius:10px; border:1px solid rgba(99,102,241,0.35); background:rgba(12,23,45,0.85); color:#f8fafc; }
    .search-input:focus, .filter-select:focus { outline:none; border-color:#60a5fa; box-shadow:0 0 0 1px rgba(96,165,250,0.45); }
    .ghost { border:1px solid rgba(148,163,184,0.45); background:rgba(8,17,33,0.6); color:#e2e8f0; padding:8px 16px; border-radius:10px; cursor:pointer; transition:background 0.15s ease, border-color 0.15s ease; }
    .ghost:hover { background:rgba(37,99,235,0.15); border-color:rgba(96,165,250,0.6); }
    .ghost.danger { border-color:rgba(248,113,113,0.6); color:#fca5a5; }
    .ghost.danger:hover { background:rgba(248,113,113,0.12); }
    .primary { background:linear-gradient(135deg,#2563eb,#4f46e5); color:#fff; border:none; padding:9px 18px; border-radius:12px; cursor:pointer; font-weight:600; letter-spacing:0.01em; box-shadow:0 10px 22px rgba(37,99,235,0.35); transition:transform 0.15s ease, box-shadow 0.15s ease; }
    .primary:disabled { opacity:0.55; cursor:not-allowed; box-shadow:none; }
    .primary:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 16px 28px rgba(37,99,235,0.45); }
    .table-area { background:linear-gradient(135deg,#051028,#0c1c3d); border-radius:16px; box-shadow:0 18px 40px rgba(4,15,35,0.6); padding:0; }
    .table-scroll { width:100%; overflow:auto; border-radius:16px; }
    .orders-table { width:100%; border-collapse:separate; border-spacing:0; min-width:1400px; color:#e2e8f0; }
    .orders-table thead th { position:sticky; top:0; background:linear-gradient(135deg,#4338ca,#2563eb); color:#f8fafc; padding:14px 16px; text-transform:uppercase; font-size:12px; letter-spacing:0.08em; border-bottom:1px solid rgba(148,163,184,0.35); z-index:2; }
    .orders-table tbody td { padding:14px 16px; border-bottom:1px solid rgba(148,163,184,0.18); background:rgba(9,18,38,0.92); font-size:14px; }
    .orders-table tbody tr:nth-child(odd) td { background:rgba(12,24,46,0.9); }
    .cell { min-width:150px; border-right:1px solid rgba(148,163,184,0.12); }
    .orders-table tbody td:first-child { background:rgba(20,35,72,0.94); font-weight:600; }
    .orders-table tbody td:nth-child(2) { background:rgba(27,40,84,0.94); font-weight:600; letter-spacing:0.04em; }
    .orders-table tbody td:nth-child(8) { color:#facc15; font-weight:600; }
    .cell.session { min-width:180px; background:rgba(24,44,82,0.9); }
    .cell.session.filled { background:rgba(40,69,120,0.9); }
    .cell.total-sessions { min-width:120px; text-align:center; font-weight:600; color:#6ee7b7; }
    .cell.earned-salary { min-width:150px; text-align:right; font-weight:600; color:#fcd34d; }
    .cell.payment-status { min-width:150px; }
    .cell.payment-invoice { min-width:180px; }
    .cell.payment-proof { min-width:150px; }
    .cell.status { min-width:140px; text-align:center; font-weight:600; }
    .cell.status.active { color:#6ee7b7; }
    .cell.status.locked { color:#fca5a5; }
    .preview-link { display:block; margin-top:4px; font-size:12px; color:#93c5fd; }
    .session-details { display:flex; flex-direction:column; gap:6px; font-size:12px; color:#e2e8f0; }
    .session-details .label { display:inline-block; min-width:68px; font-weight:600; color:#cbd5f5; margin-right:4px; }
    .session-details span + span { font-weight:500; }
    .session-actions { display:flex; gap:8px; margin-top:8px; }
    .session-actions a { color:#93c5fd; text-decoration:none; font-weight:600; font-size:12px; }
    .session-actions a:hover { text-decoration:underline; }
    .cell.actions { display:flex; flex-direction:column; gap:8px; align-items:flex-end; background:rgba(12,30,58,0.95); }
    .locked-message { font-size:12px; color:#fca5a5; font-weight:600; padding:4px 8px; }
    .cell.editing { background:rgba(25,53,94,0.9); }
    .cell.editing select,
    .cell.editing input { background:rgba(5,18,40,0.95); color:#f1f5f9; border:1px solid rgba(96,165,250,0.4); border-radius:10px; padding:9px 12px; }
    .cell.editing select:focus,
    .cell.editing input:focus { outline:none; border-color:#60a5fa; box-shadow:0 0 0 1px rgba(96,165,250,0.45); }
    .cell.editing .compact { padding:7px 12px; font-size:13px; }
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:48px; border-radius:16px; background:linear-gradient(135deg,#061432,#0c1f42); box-shadow:0 18px 38px rgba(4,15,37,0.55); }
    .empty-state p { margin:0; font-size:15px; }
    .error { color:#fca5a5; font-size:12px; text-align:right; }
  `],
})
export class OrdersComponent {
  private readonly NEW_ID = '__new__';

  orders = signal<OrderItem[]>([]);
  teachers = signal<UserItem[]>([]);
  sales = signal<UserItem[]>([]);
  classes = signal<ClassItem[]>([]);
  students = signal<StudentItem[]>([]);
  selectedStudentData = signal<any>(null);
  keyword = signal('');
  teacherFilter = signal('');
  classFilter = signal('');
  error = signal('');
  sessionColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  form: OrderFormState = this.blankForm();
  editingId: string | null = null;

  availableInvoices = computed(() => {
    const studentData = this.selectedStudentData();
    if (!studentData || !studentData.payments) return [];
    return studentData.payments
      .filter((p: any) => p.invoiceCode)
      .map((p: any) => ({
        code: p.invoiceCode,
        sessions: p.sessionsRegistered || 0
      }));
  });

  filtered = computed(() => {
    const kw = this.keyword().trim().toLowerCase();
    const teacherFilter = this.teacherFilter();
    const classFilter = this.classFilter();
    return this.orders()
      .filter((order) => {
        if (teacherFilter && order.teacherId !== teacherFilter) return false;
        if (classFilter && order.classId !== classFilter) return false;
        if (!kw) return true;
        return (
          order.studentName.toLowerCase().includes(kw) ||
          order.studentCode.toLowerCase().includes(kw) ||
          (order.parentName || '').toLowerCase().includes(kw) ||
          (order.saleName || '').toLowerCase().includes(kw)
        );
      })
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  });

  constructor(
    private orderService: OrderService,
    private userService: UserService,
    private classService: ClassService,
    private studentService: StudentService,
  ) {
    this.loadReferenceData();
    this.reload();
  }

  async loadReferenceData() {
    const [teachers, sales, classes, students] = await Promise.all([
      this.userService.listTeachers(),
      this.userService.listSales(),
      this.classService.list(),
      this.studentService.list(),
    ]);
    this.teachers.set(teachers);
    this.sales.set(sales);
    this.classes.set(classes);
    this.students.set(students);
  }

  async reload() {
    const data = await this.orderService.list();
    this.orders.set(data);
  }

  resetFilters() {
    this.keyword.set('');
    this.teacherFilter.set('');
    this.classFilter.set('');
  }

  startCreate() {
    if (this.isEditing()) return;
    this.editingId = this.NEW_ID;
    this.form = this.blankForm();
    this.error.set('');
  }

  startEdit(order: OrderItem) {
    if (this.isEditing()) return;
    this.editingId = order._id;
    this.form = {
      studentName: order.studentName,
      studentCode: order.studentCode,
      level: order.level || '',
      parentName: order.parentName,
      teacherId: order.teacherId || '',
      teacherName: order.teacherName || '',
      teacherEmail: order.teacherEmail || '',
      teacherCode: order.teacherCode || '',
      teacherSalary: order.teacherSalary != null ? String(order.teacherSalary) : '',
      saleId: order.saleId || '',
      saleName: order.saleName || '',
      saleEmail: order.saleEmail || '',
      classId: order.classId || '',
      classCode: order.classCode || '',
      invoiceNumber: order.invoiceNumber || '',
      sessionsByInvoice: order.sessionsByInvoice != null ? String(order.sessionsByInvoice) : '',
      dataStatus: order.dataStatus || '',
      trialOrGift: order.trialOrGift || '',
      paymentStatus: order.paymentStatus || '',
      paymentInvoiceCode: order.paymentInvoiceCode || '',
      paymentProofImage: order.paymentProofImage || '',
      status: order.status || 'Đang hoạt động',
    };
    this.error.set('');
  }

  cancel() {
    this.editingId = null;
    this.form = this.blankForm();
    this.error.set('');
  }

  async remove(order: OrderItem) {
    if (this.isEditing()) return;
    if (!confirm(`Xóa đơn hàng của học sinh ${order.studentName}?`)) return;
    const result = await this.orderService.remove(order._id);
    if (!result.ok) {
      alert(result.message || 'Không thể xóa đơn hàng');
      return;
    }
    await this.reload();
  }

  async save() {
    if (!this.editingId) return;
    const payload: OrderPayload = {
      studentName: this.form.studentName.trim(),
      studentCode: this.form.studentCode.trim(),
      level: this.form.level.trim() || undefined,
      parentName: this.form.parentName.trim(),
      teacherId: this.form.teacherId || undefined,
      teacherName: this.form.teacherName.trim() || undefined,
      teacherEmail: this.form.teacherEmail.trim() || undefined,
      teacherCode: this.form.teacherCode.trim() || undefined,
      teacherSalary: this.form.teacherSalary ? Number(this.form.teacherSalary) : undefined,
      saleId: this.form.saleId || undefined,
      saleName: this.form.saleName.trim() || undefined,
      saleEmail: this.form.saleEmail.trim() || undefined,
      classId: this.form.classId || undefined,
      classCode: this.form.classCode.trim() || undefined,
      invoiceNumber: this.form.invoiceNumber.trim() || undefined,
      sessionsByInvoice: this.form.sessionsByInvoice ? Number(this.form.sessionsByInvoice) : undefined,
      dataStatus: this.form.dataStatus.trim() || undefined,
      trialOrGift: this.form.trialOrGift.trim() || undefined,
      paymentStatus: this.form.paymentStatus.trim() || undefined,
      paymentInvoiceCode: this.form.paymentInvoiceCode.trim() || undefined,
      paymentProofImage: this.form.paymentProofImage.trim() || undefined,
      status: this.form.status.trim() || 'Đang hoạt động',
    };

    if (!payload.studentName || !payload.studentCode || !payload.parentName) {
      this.error.set('Vui lòng nhập tên học sinh, mã học sinh và tên phụ huynh.');
      return;
    }

    const isCreate = this.isCreating();
    const result = isCreate
      ? await this.orderService.create(payload)
      : await this.orderService.update(this.editingId, payload);

    if (!result.ok) {
      this.error.set(result.message || 'Không thể lưu đơn hàng');
      return;
    }

    await this.reload();
    this.cancel();
  }

  handleTeacherChange(teacherId: string) {
    if (!teacherId) {
      this.form.teacherName = '';
      this.form.teacherEmail = '';
      this.form.teacherCode = '';
      return;
    }
    
    if (teacherId === '__new__') {
      // Enable manual input for new teacher
      this.form.teacherName = '';
      this.form.teacherEmail = '';
      this.form.teacherCode = '';
      return;
    }
    
    const teacher = this.teachers().find((t) => t._id === teacherId);
    if (!teacher) return;
    this.form.teacherName = teacher.fullName;
    this.form.teacherEmail = teacher.email;
    this.form.teacherCode = teacher.email.split('@')[0] || '';
  }

  async handleStudentCodeChange(studentCode: string) {
    if (!studentCode) {
      this.form.studentName = '';
      this.form.parentName = '';
      this.form.level = '';
      this.form.saleId = '';
      this.form.saleName = '';
      this.form.saleEmail = '';
      this.form.invoiceNumber = '';
      this.form.sessionsByInvoice = '';
      this.selectedStudentData.set(null);
      return;
    }

    // Find student from loaded list
    const student = this.students().find(s => s.studentCode === studentCode);
    if (!student) return;

    // Fetch full student detail with payments from backend
    const res = await fetch(`${environment.apiBase}/students/${student._id}`, {
      headers: { Authorization: `Bearer ${this.studentService['auth'].getToken()}` }
    });
    
    if (res.ok) {
      const fullStudent = await res.json();
      this.selectedStudentData.set(fullStudent);
      this.form.studentName = fullStudent.fullName || '';
      this.form.parentName = fullStudent.parentName || '';
      this.form.level = ''; // Can be filled if available in student data
      
      // Auto-fill sale info if student has saleId
      if (fullStudent.saleId) {
        const sale = this.sales().find(s => s._id === fullStudent.saleId);
        if (sale) {
          this.form.saleId = sale._id;
          this.form.saleName = sale.fullName;
          this.form.saleEmail = sale.email;
        }
      } else if (fullStudent.saleName) {
        this.form.saleName = fullStudent.saleName;
        this.form.saleEmail = '';
      }
      
      // Reset invoice selection
      this.form.invoiceNumber = '';
      this.form.sessionsByInvoice = '';
    }
  }

  handleInvoiceChange(invoiceCode: string) {
    if (!invoiceCode) {
      this.form.sessionsByInvoice = '';
      return;
    }
    
    const invoice = this.availableInvoices().find((inv: any) => inv.code === invoiceCode);
    if (invoice) {
      this.form.sessionsByInvoice = String(invoice.sessions);
    }
  }

  handleSaleChange(saleId: string) {
    if (!saleId) {
      this.form.saleName = '';
      this.form.saleEmail = '';
      return;
    }
    const sale = this.sales().find((s) => s._id === saleId);
    if (!sale) return;
    this.form.saleName = sale.fullName;
    this.form.saleEmail = sale.email;
  }

  handleClassChange(classId: string) {
    if (!classId) {
      this.form.classCode = '';
      return;
    }
    
    if (classId === '__new__') {
      // Enable manual input for new class
      this.form.classCode = '';
      return;
    }
    
    const classroom = this.classes().find((c) => c._id === classId);
    if (!classroom) return;
    this.form.classCode = classroom.code;
  }

  handleClassCodeChange(classCode: string) {
    // When user types class code, try to find existing class
    if (!classCode) {
      this.form.classId = '';
      return;
    }
    
    const existingClass = this.classes().find(c => 
      c.code.toLowerCase() === classCode.toLowerCase()
    );
    
    if (existingClass) {
      this.form.classId = existingClass._id;
    } else {
      // Mark as new class
      this.form.classId = '__new__';
    }
  }

  sessionCell(order: OrderItem | null, sessionIndex: number): OrderSessionEntry | null {
    if (!order) return null;
    return order.sessions.find((s) => s.sessionIndex === sessionIndex) || null;
  }

  generateAttendanceCode(studentCode?: string, teacherCode?: string, sessionDate?: string, sessionIndex?: number): string {
    if (!studentCode || !teacherCode || !sessionDate) return '-';
    
    // Parse date to get month abbreviation
    const date = new Date(sessionDate);
    if (Number.isNaN(date.getTime())) return '-';
    
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthAbbr = monthNames[date.getMonth()];
    
    // Format: StudentCode + TeacherCode + MonthAbbr + SessionIndex
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

  imageUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = environment.apiBase.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  isEditing(id?: string): boolean {
    if (!this.editingId) return false;
    if (!id) return true;
    return this.editingId === id;
  }

  isCreating(): boolean {
    return this.editingId === this.NEW_ID;
  }

  private blankForm(): OrderFormState {
    return {
      studentName: '',
      studentCode: '',
      level: '',
      parentName: '',
      teacherId: '',
      teacherName: '',
      teacherEmail: '',
      teacherCode: '',
      teacherSalary: '',
      saleId: '',
      saleName: '',
      saleEmail: '',
      classId: '',
      classCode: '',
      invoiceNumber: '',
      sessionsByInvoice: '',
      dataStatus: '',
      trialOrGift: '',
      paymentStatus: '',
      paymentInvoiceCode: '',
      paymentProofImage: '',
      status: 'Đang hoạt động',
    };
  }
}

interface OrderFormState {
  studentName: string;
  studentCode: string;
  level: string;
  parentName: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherCode: string;
  teacherSalary: string;
  saleId: string;
  saleName: string;
  saleEmail: string;
  classId: string;
  classCode: string;
  invoiceNumber: string;
  sessionsByInvoice: string;
  dataStatus: string;
  trialOrGift: string;
  paymentStatus: string;
  paymentInvoiceCode: string;
  paymentProofImage: string;
  status: string;
}
