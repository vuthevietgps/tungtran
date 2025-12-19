import { CommonModule } from '@angular/common';
import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { InvoiceService } from '../services/invoice.service';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

interface PaymentInvoice {
  _id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  saleName?: string;
  frameIndex: number;
  invoiceCode: string;
  sessionsRegistered: number;
  pricePerSession: number;
  amountCollected: number;
  cod?: string;
  sessionsCollected: number;
  invoiceImage: string;
  transferDate?: string;
  confirmStatus: 'PENDING' | 'CONFIRMED';
  createdAt: string;
}

@Component({
  selector: 'app-payment-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý hóa đơn thu tiền</h2>
      <p>Theo dõi và duyệt các khoản thu tiền từ học sinh.</p>
    </div>
  </header>

  <section class="filters">
    <input placeholder="Tìm theo mã học sinh, tên, mã hóa đơn..." [(ngModel)]="keyword" (ngModelChange)="filterData()" />
    <select [(ngModel)]="statusFilter" (ngModelChange)="filterData()">
      <option value="">Tất cả trạng thái</option>
      <option value="PENDING">Chờ duyệt</option>
      <option value="CONFIRMED">Đã duyệt</option>
    </select>
    <select [(ngModel)]="saleFilter" (ngModelChange)="filterData()">
      <option value="">Tất cả sale</option>
      <option *ngFor="let sale of saleOptions" [value]="sale">{{ sale }}</option>
    </select>
    <select [(ngModel)]="monthFilter" (ngModelChange)="filterData()">
      <option value="">Tất cả tháng CK</option>
      <option *ngFor="let m of monthOptions" [value]="m">Tháng {{ m }}</option>
    </select>
    <button (click)="reload()">Làm mới</button>
  </section>

  <ng-container *ngIf="filtered().length; else empty">
  <div class="table-wrapper">
  <table class="data">
    <thead>
      <tr>
        <th class="sticky-col col-student-code">Mã HS</th>
        <th class="sticky-col col-student-name">Tên học sinh</th>
        <th>Sale</th>
        <th>Mã hóa đơn</th>
        <th>Đợt thu</th>
        <th>Ngày chuyển khoản</th>
        <th>Số buổi ĐK</th>
        <th>Giá/buổi</th>
        <th>Số tiền đã thu</th>
        <th>COD</th>
        <th>Số buổi đã thu</th>
        <th>Ảnh hóa đơn</th>
        <th>Trạng thái</th>
        <th *ngIf="canApprove()">Hành động</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let inv of filtered()">
        <td class="sticky-col col-student-code"><strong>{{ inv.studentCode }}</strong></td>
        <td class="sticky-col col-student-name">{{ inv.studentName }}</td>
        <td>{{ inv.saleName || '-' }}</td>
        <td>{{ inv.invoiceCode || 'Chưa có' }}</td>
        <td>Đợt {{ inv.frameIndex }}</td>
        <td>{{ inv.transferDate ? (inv.transferDate | date:'dd/MM/yyyy') : '-' }}</td>
        <td>{{ inv.sessionsRegistered }}</td>
        <td>{{ formatCurrency(inv.pricePerSession) }}</td>
        <td>{{ formatCurrency(inv.amountCollected) }}</td>
        <td>
          <input
            [(ngModel)]="inv.cod"
            (blur)="saveCod(inv)"
            placeholder="Nhập COD"
            [disabled]="isSavingCod(inv)"
          />
          <span class="saving" *ngIf="isSavingCod(inv)">Đang lưu...</span>
        </td>
        <td>{{ inv.sessionsCollected }}</td>
        <td>
          <img 
            *ngIf="inv.invoiceImage" 
            [src]="getImageUrl(inv.invoiceImage)" 
            alt="Hóa đơn" 
            class="receipt-thumb"
            (click)="showImageModal(getImageUrl(inv.invoiceImage))"
          />
          <span *ngIf="!inv.invoiceImage">Không có</span>
        </td>
        <td>
          <span class="status" [class.pending]="inv.confirmStatus === 'PENDING'" [class.confirmed]="inv.confirmStatus === 'CONFIRMED'">
            {{ inv.confirmStatus === 'PENDING' ? 'Chờ duyệt' : 'Đã duyệt' }}
          </span>
        </td>
        <td class="actions-cell" *ngIf="canApprove()">
          <button 
            class="primary" 
            (click)="confirmPayment(inv)" 
            *ngIf="inv.confirmStatus === 'PENDING'"
            [disabled]="loading()"
          >
            Duyệt
          </button>
          <span *ngIf="inv.confirmStatus === 'CONFIRMED'">✓ Đã duyệt</span>
        </td>
      </tr>
    </tbody>
  </table>
  </div>
  </ng-container>
  <ng-template #empty><p>Chưa có dữ liệu hóa đơn.</p></ng-template>

  <!-- Modal xem ảnh hóa đơn -->
  <div class="modal-backdrop" *ngIf="imageModalUrl()" (click)="closeImageModal()">
    <div class="modal image-modal" (click)="$event.stopPropagation()">
      <button class="close-btn" (click)="closeImageModal()">×</button>
      <img [src]="imageModalUrl()" alt="Hóa đơn" />
    </div>
  </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      color: var(--text);
    }
    .page-header h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--text);
    }
    .page-header p {
      margin: 0;
      color: var(--muted);
    }

    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .filters input,
    .filters select {
      padding: 0.625rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.9375rem;
      background: var(--panel);
      color: var(--text);
    }
    .filters input {
      flex: 1;
      min-width: 250px;
    }
    .filters select {
      min-width: 180px;
    }
    .filters button {
      padding: 0.625rem 1.25rem;
      background: var(--primary);
      color: #04121a;
      border: 1px solid var(--primary-strong);
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    .filters button:hover {
      background: var(--primary-strong);
    }

    .table-wrapper {
      overflow-x: auto;
      position: relative;
    }

    .data {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      border-radius: 10px;
      overflow: hidden;
      color: var(--text);
      border: 1px solid var(--border);
    }
    .data thead {
      background: #132544;
    }
    .data th,
    .data td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .data th {
      font-weight: 700;
      font-size: 0.875rem;
      text-transform: uppercase;
      color: var(--muted);
      letter-spacing: 0.5px;
    }
    .data tbody tr:hover {
      background: #1a2f55;
    }
    .data tbody tr:last-child td {
      border-bottom: none;
    }

    .sticky-col {
      position: sticky;
      left: 0;
      background: #132544;
      z-index: 2;
    }
    .data thead .sticky-col {
      z-index: 3;
    }
    .col-student-code {
      left: 0;
      min-width: 110px;
    }
    .col-student-name {
      left: 130px;
      min-width: 160px;
    }

    .receipt-thumb {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid var(--border);
      transition: transform 0.2s;
    }
    .receipt-thumb:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }

    .status {
      display: inline-block;
      padding: 0.375rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8125rem;
      font-weight: 700;
      border: 1px solid var(--border);
    }
    .status.pending {
      background: rgba(245,158,11,0.18);
      color: #fcd34d;
      border-color: #f59e0b;
    }
    .status.confirmed {
      background: rgba(52,211,153,0.18);
      color: #bbf7d0;
      border-color: #22c55e;
    }

    .actions-cell {
      white-space: nowrap;
    }
    .actions-cell button {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.875rem;
      background: var(--panel);
      color: var(--text);
    }
    .actions-cell button.primary {
      background: var(--primary);
      color: #04121a;
      border-color: var(--primary-strong);
    }
    .actions-cell button.primary:hover:not(:disabled) {
      background: var(--primary-strong);
    }
    .actions-cell button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: var(--surface);
      color: var(--text);
      padding: 2rem;
      border-radius: 12px;
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
      overflow: auto;
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }
    .modal.image-modal {
      padding: 1rem;
    }
    .modal.image-modal img {
      max-width: 100%;
      max-height: 80vh;
      display: block;
    }
      .close-btn {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: var(--danger);
        color: #fff;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 1.5rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
    .close-btn:hover {
      background: #f87171;
    }

    button.primary {
      background: #007bff;
      color: white;
      border: none;
      padding: 0.625rem 1.25rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }
    button.primary:hover {
      background: #0056b3;
    }

    td input {
      width: 140px;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    .saving {
      display: inline-block;
      margin-left: 0.5rem;
      color: #007bff;
      font-size: 0.8125rem;
    }
  `]
})
export class InvoicesComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private invoiceService = inject(InvoiceService);
  private subscription?: Subscription;

  invoices = signal<PaymentInvoice[]>([]);
  keyword = '';
  statusFilter = '';
  saleFilter = '';
  monthFilter = '';
  monthOptions: number[] = [1,2,3,4,5,6,7,8,9,10,11,12];
  saleOptions: string[] = [];
  loading = signal(false);
  imageModalUrl = signal('');
  savingCod = signal<Record<string, boolean>>({});

  filtered = computed(() => {
    let result = this.invoices();
    
    if (this.keyword.trim()) {
      const kw = this.keyword.toLowerCase();
      result = result.filter(inv =>
        inv.studentCode.toLowerCase().includes(kw) ||
        inv.studentName.toLowerCase().includes(kw) ||
        inv.invoiceCode?.toLowerCase().includes(kw)
      );
    }
    
    if (this.statusFilter) {
      result = result.filter(inv => inv.confirmStatus === this.statusFilter);
    }

    if (this.saleFilter) {
      result = result.filter(inv => (inv.saleName || '').toLowerCase() === this.saleFilter.toLowerCase());
    }

    if (this.monthFilter) {
      const monthSelected = Number(this.monthFilter);
      result = result.filter(inv => {
        if (!inv.transferDate || !monthSelected) return false;
        const d = new Date(inv.transferDate);
        return d.getMonth() + 1 === monthSelected;
      });
    }
    
    return result;
  });

  ngOnInit() {
    this.loadInvoices();
    
    // Subscribe để tự động reload khi có payment được duyệt
    this.subscription = this.invoiceService.onPaymentConfirmed.subscribe(() => {
      this.loadInvoices();
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  loadInvoices() {
    this.loading.set(true);
    this.http.get<PaymentInvoice[]>(`${environment.apiBase}/invoices/payments/all`).subscribe({
      next: (data) => {
        this.invoices.set(data);
        this.buildFilterOptions(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Load invoices error:', err);
        alert('Lỗi tải dữ liệu hóa đơn');
        this.loading.set(false);
      }
    });
  }

  reload() {
    this.loadInvoices();
  }

  filterData() {
    // Trigger computed signal update
  }

  canApprove(): boolean {
    const user = this.auth.userSignal();
    return user?.role === 'DIRECTOR' || user?.role === 'MANAGER';
  }

  confirmPayment(invoice: PaymentInvoice) {
    if (!confirm(`Xác nhận duyệt khoản thu tiền đợt ${invoice.frameIndex} của học sinh ${invoice.studentName}?`)) {
      return;
    }

    this.loading.set(true);
    this.invoiceService.confirmPayment(invoice.studentId, invoice.frameIndex).subscribe({
      next: () => {
        alert('Đã duyệt thành công');
        // Service sẽ tự broadcast event, component này và StudentsComponent đều reload
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Confirm payment error:', err);
        alert('Lỗi duyệt thanh toán: ' + (err.error?.message || 'Unknown error'));
        this.loading.set(false);
      }
    });
  }

  saveCod(inv: PaymentInvoice) {
    const key = this.buildPaymentKey(inv);
    if (this.isSavingCod(inv)) return;

    this.setSavingCod(key, true);
    this.invoiceService.updatePaymentFrame(inv.studentId, inv.frameIndex, { cod: inv.cod || '' }).subscribe({
      next: () => {
        this.setSavingCod(key, false);
      },
      error: (err) => {
        console.error('Update COD error:', err);
        alert('Lỗi lưu COD: ' + (err.error?.message || 'Unknown error'));
        this.setSavingCod(key, false);
      }
    });
  }

  private buildPaymentKey(inv: PaymentInvoice): string {
    return `${inv.studentId}-${inv.frameIndex}`;
  }

  isSavingCod(inv: PaymentInvoice): boolean {
    return !!this.savingCod()[this.buildPaymentKey(inv)];
  }

  private setSavingCod(key: string, value: boolean) {
    const current = { ...this.savingCod() };
    if (value) {
      current[key] = true;
    } else {
      delete current[key];
    }
    this.savingCod.set(current);
  }

  private buildFilterOptions(data: PaymentInvoice[]) {
    const saleSet = new Set<string>();
    const monthSet = new Set<string>();

    data.forEach(inv => {
      if (inv.saleName) {
        saleSet.add(inv.saleName);
      }
    });

    this.saleOptions = Array.from(saleSet).sort((a, b) => a.localeCompare(b));
  }

  formatCurrency(amount: number): string {
    if (!amount) return '0 đ';
    return amount.toLocaleString('vi-VN') + ' đ';
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiBase}/${path}`;
  }

  showImageModal(url: string) {
    this.imageModalUrl.set(url);
  }

  closeImageModal() {
    this.imageModalUrl.set('');
  }
}
