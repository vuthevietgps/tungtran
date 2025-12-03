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
  frameIndex: number;
  invoiceCode: string;
  sessionsRegistered: number;
  pricePerSession: number;
  amountCollected: number;
  sessionsCollected: number;
  invoiceImage: string;
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
    <button (click)="reload()">Làm mới</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead>
      <tr>
        <th>Mã HS</th>
        <th>Tên học sinh</th>
        <th>Đợt thu</th>
        <th>Mã hóa đơn</th>
        <th>Số buổi ĐK</th>
        <th>Giá/buổi</th>
        <th>Số tiền đã thu</th>
        <th>Số buổi đã thu</th>
        <th>Ảnh hóa đơn</th>
        <th>Trạng thái</th>
        <th *ngIf="canApprove()">Hành động</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let inv of filtered()">
        <td><strong>{{ inv.studentCode }}</strong></td>
        <td>{{ inv.studentName }}</td>
        <td>Đợt {{ inv.frameIndex }}</td>
        <td>{{ inv.invoiceCode || 'Chưa có' }}</td>
        <td>{{ inv.sessionsRegistered }}</td>
        <td>{{ formatCurrency(inv.pricePerSession) }}</td>
        <td>{{ formatCurrency(inv.amountCollected) }}</td>
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
    }
    .page-header h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.75rem;
      font-weight: 600;
    }
    .page-header p {
      margin: 0;
      color: #666;
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
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.9375rem;
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
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }
    .filters button:hover {
      background: #0056b3;
    }

    .data {
      width: 100%;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
      border-radius: 6px;
      overflow: hidden;
    }
    .data thead {
      background: #f8f9fa;
    }
    .data th,
    .data td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e9ecef;
    }
    .data th {
      font-weight: 600;
      font-size: 0.875rem;
      text-transform: uppercase;
      color: #495057;
      letter-spacing: 0.5px;
    }
    .data tbody tr:hover {
      background: #f8f9fa;
    }
    .data tbody tr:last-child td {
      border-bottom: none;
    }

    .receipt-thumb {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #ddd;
      transition: transform 0.2s;
    }
    .receipt-thumb:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .status {
      display: inline-block;
      padding: 0.375rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8125rem;
      font-weight: 600;
    }
    .status.pending {
      background: #fff3cd;
      color: #856404;
    }
    .status.confirmed {
      background: #d4edda;
      color: #155724;
    }

    .actions-cell {
      white-space: nowrap;
    }
    .actions-cell button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.875rem;
    }
    .actions-cell button.primary {
      background: #28a745;
      color: white;
    }
    .actions-cell button.primary:hover:not(:disabled) {
      background: #218838;
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
      background: white;
      padding: 2rem;
      border-radius: 8px;
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
      overflow: auto;
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
      background: rgba(0, 0, 0, 0.5);
      color: white;
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
      background: rgba(0, 0, 0, 0.7);
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
  loading = signal(false);
  imageModalUrl = signal('');

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
