import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { PaymentRequestItem, PaymentRequestService } from '../services/payment-request.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-payment-requests',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="payment-requests-screen">
      <header class="control-bar">
        <h2 class="page-title">Đề nghị thanh toán</h2>
        <div class="control-actions">
          <button type="button" class="ghost" (click)="reload()">Làm mới</button>
        </div>
        <div class="control-stats">
          <span class="badge badge-total">Tổng: {{ requests().length }}</span>
        </div>
      </header>

      <section class="table-area">
        <ng-container *ngIf="requests().length; else empty">
          <div class="table-scroll">
            <table class="requests-table">
              <thead>
                <tr>
                  <th>Mã HS</th>
                  <th>Tên HS</th>
                  <th>Mã lớp</th>
                  <th>Lương GV</th>
                  <th *ngFor="let col of sessionColumns">Buổi {{ col }}</th>
                  <th>Tổng số buổi học đã điểm danh</th>
                  <th>Lương GV được nhận</th>
                  <th>Trạng thái thanh toán</th>
                  <th>Mã hóa đơn thanh toán</th>
                  <th>Ảnh chứng từ</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let request of requests()">
                  <td class="cell code">{{ request.studentCode }}</td>
                  <td class="cell student-name">{{ request.studentName }}</td>
                  <td class="cell class-code">{{ request.classCode }}</td>
                  <td class="cell teacher-salary">{{ request.teacherSalary != null ? (request.teacherSalary | number:'1.0-0') : '-' }}</td>
                  <td *ngFor="let col of sessionColumns" class="cell session" [class.filled]="sessionCell(request, col)">
                    <ng-container *ngIf="sessionCell(request, col) as session; else emptyCell">
                      <div class="session-details">
                        <div><span class="label">Buổi:</span><span>{{ session.sessionIndex }}</span></div>
                        <div *ngIf="session.date"><span class="label">Ngày:</span><span>{{ formatDate(session.date) }}</span></div>
                        <div *ngIf="session.attendedAt"><span class="label">Điểm danh:</span><span>{{ formatDateTime(session.attendedAt) }}</span></div>
                      </div>
                      <div class="session-actions" *ngIf="session.imageUrl">
                        <a [href]="imageUrl(session.imageUrl)" target="_blank">Ảnh</a>
                      </div>
                    </ng-container>
                  </td>
                  <td class="cell total-sessions">{{ request.totalAttendedSessions }}</td>
                  <td class="cell earned-salary">{{ request.teacherEarnedSalary | number:'1.0-0' }}</td>
                  <td class="cell payment-status" [class.pending]="!request.paymentStatus" [class.requested]="request.paymentStatus === 'Đề nghị thanh toán'">
                    {{ request.paymentStatus || 'Chưa đề nghị' }}
                  </td>
                  <td class="cell payment-invoice">{{ request.paymentInvoiceCode || '-' }}</td>
                  <td class="cell payment-proof">
                    <a *ngIf="request.paymentProofImage" [href]="imageUrl(request.paymentProofImage)" target="_blank">Xem ảnh</a>
                    <span *ngIf="!request.paymentProofImage">-</span>
                  </td>
                  <td class="cell actions">
                    <button 
                      *ngIf="request.paymentStatus !== 'Đề nghị thanh toán' && request.paymentStatus !== 'Đã thanh toán'"
                      class="primary" 
                      (click)="submitRequest(request)"
                      [disabled]="loading()">
                      Đề nghị thanh toán
                    </button>
                    <span *ngIf="request.paymentStatus === 'Đề nghị thanh toán'" class="status-badge requested">Đã đề nghị</span>
                    <span *ngIf="request.paymentStatus === 'Đã thanh toán'" class="status-badge paid">Đã thanh toán</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>
      </section>
    </div>

    <ng-template #empty>
      <div class="empty-state">
        <p>Chưa có dữ liệu đề nghị thanh toán.</p>
        <p class="hint">Dữ liệu sẽ tự động được tạo từ đơn hàng.</p>
      </div>
    </ng-template>

    <ng-template #emptyCell><span>-</span></ng-template>
  `,
  styles: [`
    :host { display:block; color:#e2e8f0; }
    .payment-requests-screen { display:flex; flex-direction:column; gap:18px; }
    .control-bar { display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,#061432,#0b1f47); padding:18px 24px; border-radius:16px; box-shadow:0 18px 45px rgba(4,12,30,0.55); }
    .page-title { margin:0; font-size:20px; font-weight:700; color:#f8fafc; }
    .control-actions { display:flex; gap:12px; align-items:center; }
    .control-stats { display:flex; gap:10px; align-items:center; }
    .badge { padding:6px 12px; border-radius:999px; font-size:13px; font-weight:600; letter-spacing:0.02em; }
    .badge-total { background:rgba(37,99,235,0.18); color:#93c5fd; }
    .ghost { border:1px solid rgba(148,163,184,0.45); background:rgba(8,17,33,0.6); color:#e2e8f0; padding:8px 16px; border-radius:10px; cursor:pointer; transition:background 0.15s ease, border-color 0.15s ease; }
    .ghost:hover { background:rgba(37,99,235,0.15); border-color:rgba(96,165,250,0.6); }
    .primary { background:linear-gradient(135deg,#2563eb,#4f46e5); color:#fff; border:none; padding:9px 18px; border-radius:12px; cursor:pointer; font-weight:600; letter-spacing:0.01em; box-shadow:0 10px 22px rgba(37,99,235,0.35); transition:transform 0.15s ease, box-shadow 0.15s ease; font-size:13px; }
    .primary:disabled { opacity:0.55; cursor:not-allowed; box-shadow:none; }
    .primary:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 16px 28px rgba(37,99,235,0.45); }
    .table-area { background:linear-gradient(135deg,#051028,#0c1c3d); border-radius:16px; box-shadow:0 18px 40px rgba(4,15,35,0.6); padding:0; }
    .table-scroll { width:100%; overflow:auto; border-radius:16px; }
    .requests-table { width:100%; border-collapse:separate; border-spacing:0; min-width:2000px; color:#e2e8f0; }
    .requests-table thead th { position:sticky; top:0; background:linear-gradient(135deg,#4338ca,#2563eb); color:#f8fafc; padding:14px 16px; text-transform:uppercase; font-size:12px; letter-spacing:0.08em; border-bottom:1px solid rgba(148,163,184,0.35); z-index:2; }
    .requests-table tbody td { padding:14px 16px; border-bottom:1px solid rgba(148,163,184,0.18); background:rgba(9,18,38,0.92); font-size:14px; }
    .requests-table tbody tr:nth-child(odd) td { background:rgba(12,24,46,0.9); }
    .requests-table tbody tr:hover td { background:rgba(30,58,108,0.85); }
    .cell { min-width:120px; border-right:1px solid rgba(148,163,184,0.12); }
    .cell.code { font-weight:600; color:#93c5fd; }
    .cell.student-name { min-width:180px; font-weight:600; }
    .cell.class-code { font-weight:600; color:#a5b4fc; }
    .cell.teacher-salary { min-width:120px; text-align:right; font-weight:600; color:#facc15; }
    .cell.session { min-width:180px; background:rgba(24,44,82,0.9); }
    .cell.session.filled { background:rgba(40,69,120,0.9); }
    .session-details { display:flex; flex-direction:column; gap:6px; font-size:12px; color:#e2e8f0; }
    .session-details .label { display:inline-block; min-width:68px; font-weight:600; color:#cbd5f5; margin-right:4px; }
    .session-actions { display:flex; gap:8px; margin-top:8px; }
    .session-actions a { color:#93c5fd; text-decoration:none; font-weight:600; font-size:12px; }
    .session-actions a:hover { text-decoration:underline; }
    .cell.total-sessions { min-width:120px; text-align:center; font-weight:600; color:#6ee7b7; }
    .cell.earned-salary { min-width:150px; text-align:right; font-weight:600; color:#fcd34d; }
    .cell.payment-status { min-width:150px; text-align:center; font-weight:600; }
    .cell.payment-status.pending { color:#94a3b8; }
    .cell.payment-status.requested { color:#fbbf24; }
    .cell.payment-invoice { min-width:180px; }
    .cell.payment-proof { min-width:150px; }
    .cell.actions { display:flex; gap:8px; align-items:center; justify-content:center; background:rgba(12,30,58,0.95); }
    .status-badge { padding:6px 12px; border-radius:999px; font-size:12px; font-weight:600; }
    .status-badge.requested { background:rgba(251,191,36,0.2); color:#fbbf24; }
    .status-badge.paid { background:rgba(16,185,129,0.2); color:#6ee7b7; }
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:48px; border-radius:16px; background:linear-gradient(135deg,#061432,#0c1f42); box-shadow:0 18px 38px rgba(4,15,37,0.55); }
    .empty-state p { margin:0; font-size:15px; }
    .empty-state .hint { font-size:13px; color:#94a3b8; }
  `],
})
export class PaymentRequestsComponent {
  requests = signal<PaymentRequestItem[]>([]);
  loading = signal(false);
  sessionColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

  constructor(private paymentRequestService: PaymentRequestService) {
    this.reload();
  }

  async reload() {
    this.loading.set(true);
    const data = await this.paymentRequestService.list();
    this.requests.set(data);
    this.loading.set(false);
  }

  async submitRequest(request: PaymentRequestItem) {
    if (!confirm(`Đề nghị thanh toán cho học sinh ${request.studentName} (${request.studentCode})?`)) return;
    
    this.loading.set(true);
    const result = await this.paymentRequestService.submitRequest(request._id);
    
    if (!result.ok) {
      alert(result.message || 'Không thể đề nghị thanh toán');
      this.loading.set(false);
      return;
    }
    
    await this.reload();
  }

  sessionCell(request: PaymentRequestItem, sessionIndex: number) {
    return request.sessions.find(s => s.sessionIndex === sessionIndex) || null;
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
}
