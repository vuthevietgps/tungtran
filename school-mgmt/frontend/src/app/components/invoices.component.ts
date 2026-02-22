import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  InvoiceItem,
  InvoiceService,
  InvoiceStatus,
  InvoiceUpsertPayload,
} from '../services/invoice.service';
import { StudentItem, StudentService } from '../services/student.service';
import { ClassItem, ClassService } from '../services/class.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface InvoiceForm {
  invoiceNumber: string;
  studentId: string;
  classId: string;
  sessions: number;
  pricePerSession: number;
  amount: number;
  paymentDate: string;
  description: string;
  receiptImage: string;
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quan ly hoa don</h2>
      <p>Theo doi thanh toan cua hoc sinh theo tung lop hoc.</p>
    </div>
    <button class="primary" (click)="openModal()">+ Them hoa don</button>
  </header>

  <section class="filters">
    <input
      placeholder="Tim theo so hoa don, ten hoc sinh, ma lop"
      [(ngModel)]="keyword"
    />
    <select [(ngModel)]="statusFilter">
      <option value="">Tat ca trang thai</option>
      <option value="PENDING_APPROVAL">Cho duyet</option>
      <option value="APPROVED">Da duyet</option>
      <option value="REJECTED">Tu choi</option>
      <option value="CANCELLED">Da huy</option>
      <option value="PAID">Da thanh toan (legacy)</option>
      <option value="PENDING">Cho thanh toan (legacy)</option>
    </select>
    <button (click)="reload()">Lam moi</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead>
      <tr>
        <th>So hoa don</th>
        <th>Hoc sinh</th>
        <th>Lop hoc</th>
        <th>So buoi</th>
        <th>Gia/buoi</th>
        <th>Tong tien</th>
        <th>Ngay TT</th>
        <th>Trang thai</th>
        <th>Chung tu</th>
        <th>Hanh dong</th>
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
          <span *ngIf="!invoice.classId" class="muted-text">Chua gan lop</span>
        </td>
        <td>{{ invoice.sessions || '-' }}</td>
        <td>{{ invoice.pricePerSession ? formatCurrency(invoice.pricePerSession) : '-' }}</td>
        <td><strong>{{ formatCurrency(invoice.amount) }}</strong></td>
        <td>{{ formatDate(invoice.paymentDate) }}</td>
        <td>
          <span [ngClass]="['status', getStatusClass(invoice.status)]">
            {{ getStatusText(invoice.status) }}
          </span>
        </td>
        <td>
          <img
            *ngIf="invoice.receiptImage"
            [src]="getImageUrl(invoice.receiptImage)"
            alt="Chung tu"
            class="receipt-thumb"
            (click)="showImageModal(getImageUrl(invoice.receiptImage))"
          />
          <span *ngIf="!invoice.receiptImage" class="muted-text">-</span>
        </td>
        <td class="actions-cell">
          <button class="ghost" (click)="edit(invoice)">Sua</button>
          <button
            class="ghost success"
            *ngIf="canApproveInvoices && invoice.status === 'PENDING_APPROVAL'"
            (click)="approve(invoice)">
            Duyet
          </button>
          <button
            class="ghost danger"
            *ngIf="canApproveInvoices && invoice.status === 'PENDING_APPROVAL'"
            (click)="reject(invoice)">
            Tu choi
          </button>
          <button class="ghost danger" (click)="remove(invoice)" *ngIf="canDeleteInvoices">Xoa</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Chua co hoa don.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingInvoice ? 'Sua hoa don' : 'Them hoa don moi' }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label>So hoa don
          <input name="invoiceNumber" [(ngModel)]="form.invoiceNumber" required />
        </label>

        <label>Hoc sinh
          <select name="studentId" [(ngModel)]="form.studentId" required>
            <option value="">-- Chon hoc sinh --</option>
            <option *ngFor="let s of students()" [value]="s._id">{{ s.fullName }} ({{ s.parentName }})</option>
          </select>
        </label>

        <label>Lop hoc (tuy chon)
          <select name="classId" [(ngModel)]="form.classId" (ngModelChange)="onClassChange()">
            <option value="">-- Chua chon lop --</option>
            <option *ngFor="let c of classes()" [value]="c._id">
              {{ c.code }} - {{ c.name }} ({{ formatCurrency(c.pricePerSession || 0) }}/buoi)
            </option>
          </select>
        </label>

        <div class="pricing-row">
          <label>So buoi dang ky
            <input name="sessions" type="number" min="1" [(ngModel)]="form.sessions" (ngModelChange)="recalcAmount()" />
          </label>
          <label>Gia / buoi (VND)
            <input
              name="pricePerSession"
              type="number"
              min="0"
              [(ngModel)]="form.pricePerSession"
              (ngModelChange)="recalcAmount()"
            />
          </label>
        </div>

        <label>Tong tien (VND)
          <input name="amount" type="number" min="0" [(ngModel)]="form.amount" required />
        </label>

        <label>Ngay thanh toan
          <input name="paymentDate" type="date" [(ngModel)]="form.paymentDate" required />
        </label>

        <p class="hint">Trang thai duoc he thong quan ly. Hoa don moi se o trang thai cho duyet.</p>

        <label>Mo ta
          <textarea
            name="description"
            [(ngModel)]="form.description"
            rows="2"
            placeholder="Mo ta hoa don (tuy chon)"></textarea>
        </label>

        <label>Anh chung tu (tuy chon)
          <input name="receiptImage" type="file" accept="image/*" (change)="handleFileChange($event)" />
        </label>

        <div class="upload-status">
          <span *ngIf="uploading()">Dang tai anh...</span>
          <span class="error" *ngIf="uploadError()">{{ uploadError() }}</span>
          <img *ngIf="form.receiptImage && !uploading()" [src]="getImageUrl(form.receiptImage)" alt="Preview" class="preview" />
        </div>

        <div class="actions">
          <button type="submit" class="primary" [disabled]="uploading()">Luu</button>
          <button type="button" (click)="closeModal()">Huy</button>
        </div>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </form>
    </div>
  </div>

  <div class="modal-backdrop" *ngIf="modalImage()" (click)="closeImageModal()">
    <div class="image-modal">
      <span class="close" (click)="closeImageModal()">&times;</span>
      <img [src]="modalImage()" alt="Chung tu" />
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
    .status.approved { background:#d1fae5; color:#065f46; }
    .status.pending-approval { background:#fef3c7; color:#92400e; }
    .status.rejected, .status.cancelled { background:#fee2e2; color:#991b1b; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:6px 10px; border-radius:4px; cursor:pointer; }
    .ghost.success { border-color:#16a34a; color:#166534; }
    .ghost.danger { border-color:#dc2626; color:#b91c1c; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:560px; max-height:90vh; overflow-y:auto; box-shadow:0 8px 24px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .pricing-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { width:240px; text-align:right; }
    .actions-cell button { margin-left:4px; }
    .hint { margin:0; color:#64748b; font-size:12px; }
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
  form: InvoiceForm = this.blankForm();
  canDeleteInvoices = false;
  canApproveInvoices = false;
  editingInvoice: InvoiceItem | null = null;

  constructor(
    private invoiceService: InvoiceService,
    private studentService: StudentService,
    private classService: ClassService,
    private auth: AuthService,
  ) {
    void this.reload();
    void this.loadLookups();

    const role = this.auth.userSignal()?.role;
    this.canDeleteInvoices = role === 'DIRECTOR';
    this.canApproveInvoices = role === 'DIRECTOR' || role === 'ACCOUNTING';
  }

  filtered = computed(() => {
    let result = this.items();

    const kw = this.keyword.trim().toLowerCase();
    if (kw) {
      result = result.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(kw) ||
          invoice.studentId?.fullName?.toLowerCase().includes(kw) ||
          invoice.classId?.code?.toLowerCase().includes(kw) ||
          invoice.classId?.name?.toLowerCase().includes(kw),
      );
    }

    if (this.statusFilter) {
      result = result.filter((invoice) => invoice.status === this.statusFilter);
    }

    return result;
  });

  async reload(): Promise<void> {
    const data = await this.invoiceService.list();
    this.items.set(data);
  }

  async loadLookups(): Promise<void> {
    const [studs, cls] = await Promise.all([this.studentService.list(), this.classService.list()]);
    this.students.set(studs);
    this.classes.set(cls);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }

  getStatusText(status: InvoiceStatus | string): string {
    const statusMap: Record<string, string> = {
      PENDING_APPROVAL: 'Cho duyet',
      APPROVED: 'Da duyet',
      REJECTED: 'Tu choi',
      CANCELLED: 'Da huy',
      PAID: 'Da thanh toan',
      PENDING: 'Cho thanh toan',
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: InvoiceStatus | string): string {
    const classMap: Record<string, string> = {
      PENDING_APPROVAL: 'pending-approval',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      PAID: 'approved',
      PENDING: 'pending-approval',
    };
    return classMap[status] || 'pending-approval';
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    return `${environment.apiBase}${imagePath}`;
  }

  showImageModal(imageUrl: string): void {
    this.modalImage.set(imageUrl);
  }

  closeImageModal(): void {
    this.modalImage.set('');
  }

  openModal(): void {
    this.editingInvoice = null;
    this.form = this.blankForm();
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  edit(invoice: InvoiceItem): void {
    this.editingInvoice = invoice;
    this.form = {
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId._id,
      classId: invoice.classId?._id || '',
      sessions: invoice.sessions || 0,
      pricePerSession: invoice.pricePerSession || 0,
      amount: invoice.amount,
      paymentDate: invoice.paymentDate.split('T')[0],
      description: invoice.description || '',
      receiptImage: invoice.receiptImage || '',
    };
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  async submit(): Promise<void> {
    const payload: InvoiceUpsertPayload = {
      invoiceNumber: this.form.invoiceNumber.trim(),
      studentId: this.form.studentId,
      amount: Number(this.form.amount),
      paymentDate: this.form.paymentDate,
    };

    if (this.form.classId) payload.classId = this.form.classId;
    if (this.form.sessions > 0) payload.sessions = Number(this.form.sessions);
    if (this.form.pricePerSession > 0) payload.pricePerSession = Number(this.form.pricePerSession);
    if (this.form.receiptImage) payload.receiptImage = this.form.receiptImage.trim();
    if (this.form.description) payload.description = this.form.description.trim();

    const result = this.editingInvoice
      ? await this.invoiceService.update(this.editingInvoice._id, payload)
      : await this.invoiceService.create(payload);

    if (!result.ok) {
      this.error.set(
        result.message || (this.editingInvoice ? 'Khong the cap nhat hoa don' : 'Khong the tao hoa don'),
      );
      return;
    }

    this.closeModal();
    await this.reload();
  }

  async approve(invoice: InvoiceItem): Promise<void> {
    if (!confirm(`Duyet hoa don ${invoice.invoiceNumber}?`)) return;

    const result = await this.invoiceService.approve(invoice._id, 'APPROVE');
    if (!result.ok) {
      alert(result.message || 'Khong the duyet hoa don');
      return;
    }

    await this.reload();
  }

  async reject(invoice: InvoiceItem): Promise<void> {
    const reasonInput = prompt(`Ly do tu choi hoa don ${invoice.invoiceNumber} (co the bo trong):`, '');
    if (reasonInput === null) return;

    const reason = reasonInput.trim();
    const result = await this.invoiceService.approve(
      invoice._id,
      'REJECT',
      reason ? reason : undefined,
    );
    if (!result.ok) {
      alert(result.message || 'Khong the tu choi hoa don');
      return;
    }

    await this.reload();
  }

  async handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set('');
    this.uploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.uploading.set(false);

    if (!result.ok || !result.url) {
      this.uploadError.set(result.message || 'Tai anh that bai');
      return;
    }
    this.form.receiptImage = result.url;
  }

  async remove(invoice: InvoiceItem): Promise<void> {
    if (!confirm(`Xoa hoa don ${invoice.invoiceNumber}?`)) return;

    const result = await this.invoiceService.remove(invoice._id);
    if (!result.ok) {
      alert(result.message || 'Khong the xoa hoa don');
      return;
    }

    await this.reload();
  }

  private blankForm(): InvoiceForm {
    return {
      invoiceNumber: '',
      studentId: '',
      classId: '',
      sessions: 0,
      pricePerSession: 0,
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      description: '',
      receiptImage: '',
    };
  }

  onClassChange(): void {
    if (!this.form.classId) return;

    const cls = this.classes().find((c) => c._id === this.form.classId);
    if (cls?.pricePerSession) {
      this.form.pricePerSession = cls.pricePerSession;
      this.recalcAmount();
    }
  }

  recalcAmount(): void {
    if (this.form.sessions > 0 && this.form.pricePerSession > 0) {
      this.form.amount = this.form.sessions * this.form.pricePerSession;
    }
  }
}
