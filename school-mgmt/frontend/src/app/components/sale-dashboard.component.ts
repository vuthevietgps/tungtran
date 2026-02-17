import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Mới', CONTACTED: 'Đã liên hệ', CONSULTING: 'Đang tư vấn',
  INTERESTED: 'Quan tâm', CONVERTED: 'Đã chuyển đổi',
  NOT_INTERESTED: 'Không quan tâm', NO_RESPONSE: 'Không phản hồi',
};
const STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', CONTACTED: '#8b5cf6', CONSULTING: '#f59e0b',
  INTERESTED: '#10b981', CONVERTED: '#059669',
  NOT_INTERESTED: '#6b7280', NO_RESPONSE: '#ef4444',
};
const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp', SUBMITTED: 'Chờ duyệt', APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối', NEEDS_INFO: 'Cần bổ sung',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy',
};
const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b', SUBMITTED: '#f59e0b', APPROVED: '#10b981',
  REJECTED: '#ef4444', NEEDS_INFO: '#8b5cf6',
  COMPLETED: '#059669', CANCELLED: '#9ca3af',
};

const FUNNEL_STATUSES = ['NEW', 'CONTACTED', 'CONSULTING', 'INTERESTED', 'CONVERTED'];

@Component({
  selector: 'app-sale-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Dashboard Sale</h2>
      <p>Tổng quan hiệu suất bán hàng &amp; theo dõi leads.</p>
    </div>
    <button class="primary" (click)="reload()">Làm mới</button>
  </header>

  <div *ngIf="loading()" class="loading-bar">Đang tải dữ liệu...</div>

  <ng-container *ngIf="data()">
    <!-- KPI Cards -->
    <section class="kpi-grid">
      <div class="kpi-card blue">
        <div class="kpi-value">{{data()!.leads.conversionRate}}%</div>
        <div class="kpi-label">Tỷ lệ chuyển đổi</div>
        <div class="kpi-sub">{{data()!.leads.converted}}/{{data()!.leads.total}} leads</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-value">{{data()!.orders.revenueGenerated | number}}đ</div>
        <div class="kpi-label">Doanh thu tháng</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-value">{{data()!.orders.commissionEarned | number}}đ</div>
        <div class="kpi-label">Hoa hồng đã nhận</div>
      </div>
      <div class="kpi-card orange">
        <div class="kpi-value">{{data()!.leads.active}}</div>
        <div class="kpi-label">Leads đang xử lý</div>
      </div>
      <div class="kpi-card teal">
        <div class="kpi-value">{{data()!.orders.commissionPending | number}}đ</div>
        <div class="kpi-label">Hoa hồng chờ duyệt</div>
      </div>
    </section>

    <!-- Lead Funnel -->
    <section class="section-card">
      <h3>Phễu chuyển đổi Lead</h3>
      <div class="funnel">
        <div class="funnel-step" *ngFor="let s of funnelStatuses; let i = index">
          <div class="funnel-bar" [style.background]="statusColor(s)" [style.width.%]="funnelWidth(s)">
            <span class="funnel-count">{{getLeadCount(s)}}</span>
          </div>
          <div class="funnel-label">{{statusLabel(s)}}</div>
          <div class="funnel-arrow" *ngIf="i < funnelStatuses.length - 1">&#8594;</div>
        </div>
      </div>
    </section>

    <!-- Follow-ups Section -->
    <section class="section-card">
      <div class="section-header">
        <h3>Follow-up hôm nay
          <span class="count-badge" *ngIf="data()!.leads.followUpsDueToday.length">
            {{data()!.leads.followUpsDueToday.length}}
          </span>
        </h3>
        <span class="overdue-badge" *ngIf="data()!.leads.followUpsOverdue > 0">
          {{data()!.leads.followUpsOverdue}} quá hạn
        </span>
      </div>
      <table class="data-table" *ngIf="data()!.leads.followUpsDueToday.length; else noFollowUps">
        <thead><tr>
          <th>Mã Lead</th><th>Phụ huynh</th><th>SĐT</th><th>Trạng thái</th><th>Hẹn Follow-up</th>
        </tr></thead>
        <tbody>
          <tr *ngFor="let f of data()!.leads.followUpsDueToday">
            <td><code>{{f.leadCode}}</code></td>
            <td>{{f.parentName}}</td>
            <td>{{f.parentPhone}}</td>
            <td>
              <span class="badge" [style.background]="statusColor(f.status) + '20'" [style.color]="statusColor(f.status)">
                {{statusLabel(f.status)}}
              </span>
            </td>
            <td>{{f.nextFollowUp | date:'dd/MM/yyyy HH:mm'}}</td>
          </tr>
        </tbody>
      </table>
      <ng-template #noFollowUps><p class="empty-text">Không có follow-up nào hôm nay.</p></ng-template>
    </section>

    <!-- Recent Orders -->
    <section class="section-card">
      <h3>Đơn hàng gần đây</h3>
      <table class="data-table" *ngIf="data()!.orders.recentOrders.length; else noOrders">
        <thead><tr>
          <th>Mã đơn</th><th>Phụ huynh</th><th>Học viên</th><th>Tổng tiền</th>
          <th>Hoa hồng</th><th>Trạng thái</th><th>Ngày tạo</th>
        </tr></thead>
        <tbody>
          <tr *ngFor="let o of data()!.orders.recentOrders">
            <td><code>{{o.orderCode}}</code></td>
            <td>{{o.parentName}}</td>
            <td>{{o.studentName}}</td>
            <td class="right">{{o.finalAmount | number}}đ</td>
            <td class="right">{{o.saleCommission ? (o.saleCommission | number) + 'đ' : '-'}}</td>
            <td>
              <span class="badge" [style.background]="orderStatusColor(o.status) + '20'" [style.color]="orderStatusColor(o.status)">
                {{orderStatusLabel(o.status)}}
              </span>
            </td>
            <td>{{o.createdAt | date:'dd/MM/yyyy'}}</td>
          </tr>
        </tbody>
      </table>
      <ng-template #noOrders><p class="empty-text">Chưa có đơn hàng nào.</p></ng-template>
    </section>

    <!-- Orders Pipeline -->
    <section class="section-card">
      <h3>Pipeline đơn hàng</h3>
      <div class="pipeline">
        <div class="pipe-card" *ngFor="let s of orderStatuses"
             [style.border-left-color]="orderStatusColor(s)">
          <div class="pipe-count">{{getOrderCount(s)}}</div>
          <div class="pipe-label">{{orderStatusLabel(s)}}</div>
        </div>
      </div>
    </section>
  </ng-container>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    .page-header h2 { margin:0; color:#0f172a; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .loading-bar { padding:12px 16px; background:#eff6ff; color:#2563eb; font-size:13px; font-weight:600; margin:0 16px; border-radius:6px; }

    /* KPI Cards */
    .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; padding:0 16px 16px; }
    .kpi-card { background:#fff; padding:16px; border-radius:8px; border-left:4px solid #e2e8f0; }
    .kpi-card.blue { border-left-color:#2563eb; background:#eff6ff; }
    .kpi-card.green { border-left-color:#059669; background:#f0fdf4; }
    .kpi-card.purple { border-left-color:#7c3aed; background:#f5f3ff; }
    .kpi-card.orange { border-left-color:#ea580c; background:#fff7ed; }
    .kpi-card.teal { border-left-color:#0d9488; background:#f0fdfa; }
    .kpi-value { font-size:24px; font-weight:700; color:#0f172a; }
    .kpi-label { font-size:12px; color:#64748b; margin-top:2px; text-transform:uppercase; letter-spacing:0.3px; }
    .kpi-sub { font-size:11px; color:#94a3b8; margin-top:4px; }

    /* Section Card */
    .section-card { background:#fff; margin:0 16px 16px; border-radius:8px; padding:16px; }
    .section-card h3 { margin:0 0 12px; font-size:15px; color:#0f172a; display:inline-flex; align-items:center; gap:8px; }
    .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .section-header h3 { margin-bottom:0; }

    /* Badges */
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .count-badge { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 6px; border-radius:99px; background:#2563eb; color:#fff; font-size:11px; font-weight:700; }
    .overdue-badge { display:inline-flex; align-items:center; padding:4px 10px; border-radius:99px; background:#fef2f2; color:#dc2626; font-size:12px; font-weight:600; border:1px solid #fca5a5; }

    /* Funnel */
    .funnel { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
    .funnel-step { display:flex; flex-direction:column; align-items:center; min-width:80px; flex:1; }
    .funnel-bar { height:40px; border-radius:6px; display:flex; align-items:center; justify-content:center; min-width:50px; transition:width 0.3s; }
    .funnel-count { color:#fff; font-weight:700; font-size:16px; text-shadow:0 1px 2px rgba(0,0,0,.2); }
    .funnel-label { font-size:11px; color:#64748b; margin-top:4px; text-align:center; }
    .funnel-arrow { font-size:16px; color:#cbd5e1; margin:0 2px; align-self:center; }

    /* Pipeline */
    .pipeline { display:flex; gap:12px; flex-wrap:wrap; }
    .pipe-card { background:#f8fafc; padding:12px 16px; border-radius:8px; border-left:4px solid #e2e8f0; min-width:100px; }
    .pipe-count { font-size:24px; font-weight:700; color:#0f172a; }
    .pipe-label { font-size:12px; color:#64748b; margin-top:2px; }

    /* Data Table */
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th, .data-table td { padding:8px 10px; border:1px solid #e2e8f0; }
    .data-table thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .data-table tbody tr:hover { background:#f8fafc; }
    .right { text-align:right; }
    code { background:#f1f5f9; padding:1px 5px; border-radius:3px; font-size:12px; color:#334155; }

    .empty-text { padding:8px 0; color:#94a3b8; font-size:13px; }
  `]
})
export class SaleDashboardComponent implements OnInit {
  private http = inject(HttpClient);

  data = signal<any>(null);
  loading = signal(false);

  funnelStatuses = FUNNEL_STATUSES;
  orderStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];

  ngOnInit() {
    this.reload();
  }

  async reload() {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${environment.apiBase}/dashboard/sales`, { withCredentials: true })
      );
      this.data.set(res);
    } catch (err) {
      console.error('Failed to load sales dashboard', err);
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#64748b'; }
  orderStatusLabel(s: string) { return ORDER_STATUS_LABELS[s] || s; }
  orderStatusColor(s: string) { return ORDER_STATUS_COLORS[s] || '#64748b'; }

  getLeadCount(status: string): number {
    return this.data()?.leads?.byStatus?.[status] || 0;
  }

  getOrderCount(status: string): number {
    return this.data()?.orders?.byStatus?.[status] || 0;
  }

  funnelWidth(status: string): number {
    const total = this.data()?.leads?.total || 1;
    const count = this.getLeadCount(status);
    const pct = Math.max((count / total) * 100, 15);
    return Math.min(pct, 100);
  }
}
