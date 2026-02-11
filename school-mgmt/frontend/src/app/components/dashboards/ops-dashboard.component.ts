import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-ops-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="dashboard">
    <h2>Dashboard Vận hành</h2>

    <div *ngIf="loading()" class="loading">Đang tải dữ liệu...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <div *ngIf="data()" class="grid">
      <!-- Quick stats -->
      <div class="card highlight blue">
        <h4>Buổi học hôm nay</h4>
        <div class="value">{{ data()!.sessions.upcomingToday }}</div>
        <small>Cần finalize: {{ data()!.sessions.needsFinalization }}</small>
      </div>
      <div class="card highlight green">
        <h4>Lớp đang hoạt động</h4>
        <div class="value">{{ data()!.classes.active }} / {{ data()!.classes.total }}</div>
      </div>
      <div class="card highlight purple">
        <h4>Giáo viên</h4>
        <div class="value">{{ data()!.teachers.active }}</div>
        <small>Chờ duyệt: {{ data()!.teachers.pendingApproval }} | Tạm ngưng: {{ data()!.teachers.suspended }}</small>
      </div>
      <div class="card highlight orange">
        <h4>Ticket giao cho tôi</h4>
        <div class="value">{{ data()!.tickets.assignedToMe }}</div>
        <small>Quá hạn: {{ data()!.tickets.overdueCount }}</small>
      </div>

      <!-- Sessions by status -->
      <div class="card">
        <h4>Buổi học ({{ data()!.sessions.total }})</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.sessions.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Classes by status -->
      <div class="card">
        <h4>Lớp học ({{ data()!.classes.total }})</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.classes.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Students -->
      <div class="card">
        <h4>Học sinh</h4>
        <p>Tổng: <strong>{{ data()!.students.total }}</strong></p>
        <p>Chờ duyệt: <strong>{{ data()!.students.pendingApproval }}</strong></p>
      </div>

      <!-- Tickets by status -->
      <div class="card">
        <h4>Ticket theo trạng thái ({{ data()!.tickets.total }})</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.tickets.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Tickets by priority -->
      <div class="card">
        <h4>Ticket theo độ ưu tiên</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.tickets.byPriority)" class="status-item">
            <span class="badge" [attr.data-priority]="item[0]">{{ priorityLabel(item[0]) }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Recent tickets -->
      <div class="card full">
        <h4>Ticket gần đây</h4>
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Người tạo</th><th>Phân công</th><th>Trạng thái</th><th>Ngày</th></tr></thead>
          <tbody>
            <tr *ngFor="let t of data()!.recentTickets">
              <td><strong>{{ t.ticketCode }}</strong></td>
              <td>{{ t.subject }}</td>
              <td>{{ t.createdBy?.fullName || 'N/A' }}</td>
              <td>{{ t.assignedTo?.fullName || '—' }}</td>
              <td><span class="badge" [attr.data-status]="t.status">{{ t.status }}</span></td>
              <td>{{ t.createdAt | date:'dd/MM HH:mm' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .dashboard { padding: 24px; }
    h2 { margin:0 0 24px; color:#1e293b; }
    .loading { text-align:center; padding:40px; color:#64748b; }
    .error { background:#fef2f2; color:#dc2626; padding:12px 16px; border-radius:8px; margin-bottom:16px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px; }
    .card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .card h4 { margin:0 0 12px; color:#475569; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; }
    .card.full { grid-column: 1 / -1; }
    .card.highlight { border-top:4px solid; }
    .card.highlight.blue { border-color:#3b82f6; }
    .card.highlight.green { border-color:#22c55e; }
    .card.highlight.purple { border-color:#8b5cf6; }
    .card.highlight.orange { border-color:#f97316; }
    .value { font-size:28px; font-weight:700; color:#1e293b; margin-bottom:4px; }
    .card small { color:#94a3b8; }
    .status-list { display:flex; flex-direction:column; gap:6px; }
    .status-item { display:flex; justify-content:space-between; align-items:center; }
    .badge { padding:2px 8px; border-radius:99px; font-size:11px; background:#e2e8f0; color:#475569; font-weight:600; }
    .badge[data-status="ACTIVE"], .badge[data-status="FINALIZED"], .badge[data-status="RESOLVED"], .badge[data-status="CLOSED"] { background:#dcfce7; color:#16a34a; }
    .badge[data-status="SCHEDULED"], .badge[data-status="OPEN"] { background:#dbeafe; color:#2563eb; }
    .badge[data-status="CANCELLED"], .badge[data-status="SUSPENDED"] { background:#fef2f2; color:#dc2626; }
    .badge[data-status="IN_PROGRESS"], .badge[data-status="PENDING"], .badge[data-status="TEACHER_COMPLETED"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-priority="URGENT"] { background:#fef2f2; color:#dc2626; font-weight:700; }
    .badge[data-priority="HIGH"] { background:#fed7aa; color:#c2410c; }
    .badge[data-priority="MEDIUM"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-priority="LOW"] { background:#e2e8f0; color:#64748b; }
    .count { font-weight:600; color:#1e293b; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th { text-align:left; padding:8px; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:12px; text-transform:uppercase; }
    .data-table td { padding:8px; border-bottom:1px solid #f1f5f9; }
    p { margin:4px 0; color:#475569; font-size:14px; }
  `]
})
export class OpsDashboardComponent implements OnInit {
  data = signal<any>(null);
  loading = signal(false);
  error = signal('');

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.dashboardService.getOpsDashboard();
      this.data.set(result);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  objectEntries(obj: any): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }

  priorityLabel(p: string): string {
    const map: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', URGENT: 'Khẩn cấp' };
    return map[p] || p;
  }
}
