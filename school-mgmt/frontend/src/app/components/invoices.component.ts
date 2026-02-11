import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InvoiceItem, InvoiceService } from '../services/invoice.service';
import { StudentItem, StudentService } from '../services/student.service';
import { ClassItem, ClassService } from '../services/class.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý hóa đơn</h2>
      <p>Theo dõi thanh toán của học sinh cho từng lớp học. Hóa đơn ghi nhận số buổi đăng ký.</p>
    </div>
    <button class="primary" (click)="openModal()">+ Thêm hóa đơn</button>
  </header>

  <section class="filters">
    <input placeholder="Tìm theo số hóa đơn, tên học sinh, mã lớp" [(ngModel)]="keyword" />
    <select [(ngModel)]="statusFilter">
      <option value="">Tất cả trạng thái</option>
      <option value="PAID">Đã thanh toán</option>
      <option value="PENDING">Chờ thanh toán</option>
      <option value="CANCELLED">Đã hủy</option>
    </select>
    <button (click)="reload()">Làm mới</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead>
      <tr>
        <th>Số hóa đơn</th>
        <th>Học sinh</th>
        <th>Lớp học</th>
        <th>Số buổi</th>
        <th>Giá/buổi</th>
        <th>Tổng tiền</th>
        <th>Ngày TT</th>
        <th>Trạng thái</th>
        <th>Chứng từ</th>
        <th>Hành động</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let invoice of filtered()">
        <td><strong>{{ invoice.invoiceNumber }}</strong></td>
        <td>
          <div>{{ invoice.studentId.fullName }}</div>
          <small>PH: {{ invoice.studentId.parentName }}</small>
        </td>
        <td>
          <span *ngIf="invoice.classId" class="chip">{{ invoice.classId.code }} - {{ invoice.classId.name }}</span>
          <span *ngIf="!invoice.classId" class="muted-text">Chưa gán lớp</span>
        </td>
        <td>{{ invoice.sessions || '—' }}</td>
        <td>{{ invoice.pricePerSession ? formatCurrency(invoice.pricePerSession) : '—' }}</td>
        <td><strong>{{ formatCurrency(invoice.amount) }}</strong></td>
        <td>{{ formatDate(invoice.paymentDate) }}</td>
        <td>
          <span class="status" [class]="getStatusClass(invoice.status)">
            {{ getStatusText(invoice.status) }}
          </span>
        </td>
        <td>
          <img 
            *ngIf="invoice.receiptImage" 
            [src]="getImageUrl(invoice.receiptImage)" 
            alt="Chứng từ" 
            class="receipt-thumb"
            (click)="showImageModal(getImageUrl(invoice.receiptImage))"
          />
          <span *ngIf="!invoice.receiptImage" class="muted-text">—</span>
        </td>
        <td class="actions-cell">
          <button class="ghost" (click)="edit(invoice)">Sửa</button>
          <button class="ghost" (click)="remove(invoice)" *ngIf="canDeleteInvoices">Xóa</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Chưa có hóa đơn.</p></ng-template>

  <!-- Modal thêm/sửa hóa đơn -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingInvoice ? 'Sửa hóa đơn' : 'Thêm hóa đơn mới' }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label>Số hóa đơn
          <input name="invoiceNumber" [(ngModel)]="form.invoiceNumber" required />
        </label>
        <label>Học sinh
          <select name="studentId" [(ngModel)]="form.studentId" required>
            <option value="">-- Chọn học sinh --</option>
            <option *ngFor="let s of students()" [value]="s._id">{{ s.fullName }} ({{ s.parentName }})</option>
          </select>
        </label>
        <label>Lớp học (tùy chọn — có thể thanh toán trước khi tạo lớp)
          <select name="classId" [(ngModel)]="form.classId" (ngModelChange)="onClassChange()">
            <option value="">-- Chưa chọn lớp --</option>
            <option *ngFor="let c of classes()" [value]="c._id">{{ c.code }} - {{ c.name }} ({{formatCurrency(c.pricePerSession || 0)}} /buổi)</option>
          </select>
        </label>
        <div class="pricing-row">
          <label>Số buổi đăng ký
            <input name="sessions" type="number" min="1" [(ngModel)]="form.sessions" (ngModelChange)="recalcAmount()" />
          </label>
          <label>Giá / buổi (VNĐ)
            <input name="pricePerSession" type="number" min="0" [(ngModel)]="form.pricePerSession" (ngModelChange)="recalcAmount()" />
          </label>
        </div>
        <label>Tổng tiền (VNĐ) — tự tính hoặc nhập trực tiếp
          <input name="amount" type="number" min="0" [(ngModel)]="form.amount" required />
        </label>
        <label>Ngày thanh toán
          <input name="paymentDate" type="date" [(ngModel)]="form.paymentDate" required />
        </label>
        <label>Trạng thái
          <select name="status" [(ngModel)]="form.status">
            <option value="PAID">Đã thanh toán</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </label>
        <label>Mô tả
          <textarea name="description" [(ngModel)]="form.description" rows="2" placeholder="Mô tả hóa đơn (tùy chọn)"></textarea>
        </label>
        <label>Ảnh chứng từ (tùy chọn)
          <input name="receiptImage" type="file" accept="image/*" (change)="handleFileChange($event)" />
        </label>
        <div class="upload-status">
          <span *ngIf="uploading()">Đang tải ảnh...</span>
          <span class="error" *ngIf="uploadError()">{{uploadError()}}</span>
          <img *ngIf="form.receiptImage && !uploading()" [src]="getImageUrl(form.receiptImage)" alt="Xem trước" class="preview" />
        </div>
        <div class="actions">
          <button type="submit" class="primary" [disabled]="uploading()">Lưu</button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal xem ảnh -->
  <div class="modal-backdrop" *ngIf="modalImage()" (click)="closeImageModal()">
    <div class="image-modal">
      <span class="close" (click)="closeImageModal()">&times;</span>
      <img [src]="modalImage()" alt="Chứng từ" />
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .filters { display:flex; gap:10px; margin-bottom:16px; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; width:100%; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:14px; }
    th, td { padding:8px; border:1px solid #e2e8f0; vertical-align:middle; }
    thead { background:#f1f5f9; }
    .chip { display:inline-block; background:#e0f2fe; color:#0f172a; padding:2px 8px; border-radius:999px; font-size:12px; }
    .muted-text { color:#94a3b8; font-size:13px; }
    .receipt-thumb { width:60px; height:40px; object-fit:cover; border-radius:4px; cursor:pointer; border:1px solid #cbd5f5; }
    .status { padding:4px 8px; border-radius:12px; font-size:12px; font-weight:600; }
    .status.paid { background:#d1fae5; color:#065f46; }
    .status.pending { background:#fef3c7; color:#92400e; }
    .status.cancelled { background:#fee2e2; color:#991b1b; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:6px 10px; border-radius:4px; cursor:pointer; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:560px; max-height:90vh; overflow-y:auto; box-shadow:0 8px 24px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .pricing-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { width:120px; text-align:right; }
    .actions-cell button { margin-left:4px; }
    .error { color:#dc2626; }
    .upload-status { display:flex; flex-direction:column; gap:6px; font-size:13px; }
    .preview { width:120px; height:80px; object-fit:cover; border-radius:8px; border:1px solid #cbd5f5; }
    .image-modal { position:relative; max-width:90%; max-height:90%; }
    .image-modal img { max-width:100%; max-height:90vh; border-radius:8px; }
    .close { position:absolute; top:-40px; right:0; color:white; font-size:30px; cursor:pointer; }
  `]
})
export class InvoicesComponent {
  items = signal<InvoiceItem[]>([]);
  students = signal<StudentItem[]>([]);
  classes = signal<ClassItem[]>([]);
  keyword = '';
  statusFilter = '';
  showModal = signal(false);
  modalImage = signal('');
  error = signal('');
  uploadError = signal('');
  uploading = signal(false);
  form = this.blankForm();
  canDeleteInvoices = false;
  editingInvoice: InvoiceItem | null = null;

  constructor(
    private invoiceService: InvoiceService,
    private studentService: StudentService,
    private classService: ClassService,
    private auth: AuthService
  ) {
    this.reload();
    this.loadLookups();
    this.canDeleteInvoices = this.auth.userSignal()?.role === 'DIRECTOR';
  }

  filtered = computed(() => {
    let result = this.items();
    
    const kw = this.keyword.trim().toLowerCase();
    if (kw) {
      result = result.filter((invoice) => 
        invoice.invoiceNumber.toLowerCase().includes(kw) ||
        invoice.studentId?.fullName?.toLowerCase().includes(kw) ||
        invoice.classId?.code?.toLowerCase().includes(kw) ||
        invoice.classId?.name?.toLowerCase().includes(kw)
      );
    }
    
    if (this.statusFilter) {
      result = result.filter((invoice) => invoice.status === this.statusFilter);
    }
    
    return result;
  });

  async reload() {
    const data = await this.invoiceService.list();
    this.items.set(data);
  }

  async loadLookups() {
    const [studs, cls] = await Promise.all([
      this.studentService.list(),
      this.classService.list(),
    ]);
    this.students.set(studs);
    this.classes.set(cls);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }

  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'PAID': 'Đã thanh toán',
      'PENDING': 'Chờ thanh toán',
      'CANCELLED': 'Đã hủy'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    return status.toLowerCase();
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    return `${environment.apiBase}${imagePath}`;
  }

  showImageModal(imageUrl: string) {
    this.modalImage.set(imageUrl);
  }

  closeImageModal() {
    this.modalImage.set('');
  }

  openModal() {
    this.editingInvoice = null;
    this.form = this.blankForm();
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  edit(invoice: InvoiceItem) {
    this.editingInvoice = invoice;
    this.form = {
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId._id,
      classId: invoice.classId?._id || '',
      sessions: invoice.sessions || 0,
      pricePerSession: invoice.pricePerSession || 0,
      amount: invoice.amount,
      paymentDate: invoice.paymentDate.split('T')[0],
      status: invoice.status,
      description: invoice.description || '',
      receiptImage: invoice.receiptImage || '',
    };
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  async submit() {
    const payload: any = {
      invoiceNumber: this.form.invoiceNumber.trim(),
      studentId: this.form.studentId,
      amount: Number(this.form.amount),
      paymentDate: this.form.paymentDate,
      status: this.form.status,
    };
    
    if (this.form.classId) payload.classId = this.form.classId;
    if (this.form.sessions) payload.sessions = Number(this.form.sessions);
    if (this.form.pricePerSession) payload.pricePerSession = Number(this.form.pricePerSession);
    if (this.form.receiptImage) payload.receiptImage = this.form.receiptImage.trim();
    if (this.form.description) payload.description = this.form.description.trim();
    
    let result;
    if (this.editingInvoice) {
      result = await this.invoiceService.update(this.editingInvoice._id, payload);
      if (!result.ok) {
        this.error.set(result.message || 'Không thể cập nhật hóa đơn');
        return;
      }
    } else {
      result = await this.invoiceService.create(payload);
      if (!result.ok) {
        this.error.set(result.message || 'Không thể tạo hóa đơn');
        return;
      }
    }
    
    this.closeModal();
    this.reload();
  }

  async handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadError.set('');
    this.uploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.uploading.set(false);
    if (!result.ok || !result.url) {
      this.uploadError.set(result.message || 'Tải ảnh thất bại');
      return;
    }
    this.form.receiptImage = result.url;
  }

  async remove(invoice: InvoiceItem) {
    if (!confirm(`Xóa hóa đơn ${invoice.invoiceNumber}?`)) return;
    const result = await this.invoiceService.remove(invoice._id);
    if (!result.ok) {
      alert(result.message || 'Không thể xóa hóa đơn');
      return;
    }
    this.reload();
  }

  private blankForm() {
    return {
      invoiceNumber: '',
      studentId: '',
      classId: '',
      sessions: 0,
      pricePerSession: 0,
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      status: 'PAID',
      description: '',
      receiptImage: '',
    };
  }

  /** Khi chọn lớp, tự điền giá/buổi từ lớp */
  onClassChange() {
    if (!this.form.classId) return;
    const cls = this.classes().find(c => c._id === this.form.classId);
    if (cls?.pricePerSession) {
      this.form.pricePerSession = cls.pricePerSession;
      this.recalcAmount();
    }
  }

  /** Tự tính tổng tiền = số buổi * giá/buổi */
  recalcAmount() {
    if (this.form.sessions > 0 && this.form.pricePerSession > 0) {
      this.form.amount = this.form.sessions * this.form.pricePerSession;
    }
  }
}