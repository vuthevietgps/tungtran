import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="dashboard">
    <h2>Dashboard Phụ huynh</h2>

    <div *ngIf="loading()" class="loading">Đang tải dữ liệu...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <div *ngIf="data()" class="grid">
      <!-- Wallet -->
      <div class="card highlight blue">
        <h4>Ví tiền</h4>
        <div *ngIf="!data()!.wallet" class="empty">Chưa có ví</div>
        <div *ngIf="data()!.wallet as w">
          <div class="value">{{ w.balance | number:'1.0-0' }}đ</div>
          <span class="badge" [attr.data-status]="w.status">{{ w.status === 'ACTIVE' ? 'Hoạt động' : w.status }}</span>
        </div>
      </div>
      <div class="card highlight green">
        <h4>Tổng nạp</h4>
        <div class="value">{{ data()!.wallet?.totalTopUp || 0 | number:'1.0-0' }}đ</div>
      </div>
      <div class="card highlight purple">
        <h4>Buổi cần xác nhận</h4>
        <div class="value">{{ data()!.sessions.needsConfirmation }}</div>
        <small>Tổng buổi: {{ data()!.sessions.total }}</small>
      </div>
      <div class="card highlight orange">
        <h4>Con em</h4>
        <div class="value">{{ data()!.children.total }}</div>
        <small>Ticket mở: {{ data()!.tickets.openTickets }}</small>
      </div>

      <!-- Children list -->
      <div class="card wide">
        <h4>👨‍👧‍👦 Danh sách con em</h4>
        <div *ngIf="data()!.children.list.length === 0" class="empty">Chưa có học sinh nào</div>
        <div class="children-list">
          <div *ngFor="let child of data()!.children.list" class="child-card">
            <strong>{{ child.name }}</strong>
            <span *ngIf="child.grade">Lớp {{ child.grade }}</span>
            <span *ngIf="child.subjects?.length">{{ child.subjects.join(', ') }}</span>
          </div>
        </div>
      </div>

      <!-- Session stats -->
      <div class="card">
        <h4>📊 Thống kê buổi học</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.sessions.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ statusLabel(item[0]) }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Wallet summary -->
      <div class="card" *ngIf="data()!.wallet">
        <h4>💰 Chi tiết ví</h4>
        <div class="stat-row">
          <div class="stat"><span class="num green-text">{{ data()!.wallet.totalTopUp | number:'1.0-0' }}đ</span><span class="lbl">Đã nạp</span></div>
          <div class="stat"><span class="num red-text">{{ data()!.wallet.totalDeducted | number:'1.0-0' }}đ</span><span class="lbl">Đã trừ</span></div>
          <div class="stat"><span class="num">{{ data()!.wallet.totalRefunded | number:'1.0-0' }}đ</span><span class="lbl">Hoàn trả</span></div>
        </div>
      </div>

      <!-- Upcoming sessions -->
      <div class="card full">
        <h4>📅 Lịch học sắp tới</h4>
        <div *ngIf="data()!.recentSessions.length === 0" class="empty">Không có buổi học sắp tới</div>
        <table *ngIf="data()!.recentSessions.length > 0" class="data-table">
          <thead><tr><th>Ngày giờ</th><th>Giáo viên</th><th>Học sinh</th><th>Lớp</th><th>Trạng thái</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of data()!.recentSessions">
              <td>{{ s.scheduledDate | date:'dd/MM/yyyy' }} {{ s.scheduledStartTime }}</td>
              <td>{{ s.teacherId?.fullName || 'N/A' }}</td>
              <td>{{ s.studentId?.name || 'N/A' }}</td>
              <td>{{ s.classId?.name || 'N/A' }}</td>
              <td><span class="badge" [attr.data-status]="s.status">{{ statusLabel(s.status) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- INVOICES — Lịch sử thanh toán / hóa đơn -->
      <div class="card full">
        <h4>🧾 Lịch sử thanh toán</h4>
        <div *ngIf="!data()!.invoices?.list?.length" class="empty">Chưa có hóa đơn nào</div>
        <div class="invoice-summary" *ngIf="data()!.invoices?.total">
          <span class="tag green-bg">Tổng hoá đơn: {{ data()!.invoices.total }}</span>
          <span class="tag blue-bg">Đã thanh toán: {{ data()!.invoices.totalPaid | number:'1.0-0' }}đ</span>
        </div>
        <table *ngIf="data()!.invoices?.list?.length" class="data-table">
          <thead>
            <tr>
              <th>Mã HĐ</th>
              <th>Học sinh</th>
              <th>Lớp học</th>
              <th>Số buổi</th>
              <th>Giá/buổi</th>
              <th>Tổng tiền</th>
              <th>Ngày TT</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let inv of data()!.invoices.list">
              <td class="mono">{{ inv.invoiceNumber }}</td>
              <td>{{ inv.studentId?.name || 'N/A' }} <small *ngIf="inv.studentId?.studentCode">({{ inv.studentId.studentCode }})</small></td>
              <td>{{ inv.classId?.name || '—' }} <small *ngIf="inv.classId?.code">({{ inv.classId.code }})</small></td>
              <td class="center">{{ inv.sessions || '—' }}</td>
              <td class="right">{{ inv.pricePerSession ? (inv.pricePerSession | number:'1.0-0') + 'đ' : '—' }}</td>
              <td class="right bold">{{ inv.amount | number:'1.0-0' }}đ</td>
              <td>{{ inv.paymentDate | date:'dd/MM/yyyy' }}</td>
              <td><span class="badge" [attr.data-status]="inv.status">{{ invoiceStatusLabel(inv.status) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ATTENDANCE — Lịch sử điểm danh -->
      <div class="card full">
        <h4>✅ Lịch sử điểm danh</h4>
        <div *ngIf="!data()!.attendance?.recentList?.length" class="empty">Chưa có bản ghi điểm danh</div>
        <div class="attendance-summary" *ngIf="data()!.attendance?.total">
          <span class="tag green-bg" *ngIf="data()!.attendance.byStatus['PRESENT']">Có mặt: {{ data()!.attendance.byStatus['PRESENT'] }}</span>
          <span class="tag yellow-bg" *ngIf="data()!.attendance.byStatus['LATE']">Đi muộn: {{ data()!.attendance.byStatus['LATE'] }}</span>
          <span class="tag red-bg" *ngIf="data()!.attendance.byStatus['ABSENT']">Vắng: {{ data()!.attendance.byStatus['ABSENT'] }}</span>
          <span class="tag gray-bg" *ngIf="data()!.attendance.byStatus['EXCUSED']">Xin phép: {{ data()!.attendance.byStatus['EXCUSED'] }}</span>
          <span class="tag blue-bg">Tổng: {{ data()!.attendance.total }}</span>
        </div>
        <table *ngIf="data()!.attendance?.recentList?.length" class="data-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Học sinh</th>
              <th>Lớp</th>
              <th>Giáo viên</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of data()!.attendance.recentList">
              <td>{{ a.date | date:'dd/MM/yyyy' }}</td>
              <td>{{ a.studentId?.name || 'N/A' }} <small *ngIf="a.studentId?.studentCode">({{ a.studentId.studentCode }})</small></td>
              <td>{{ a.classId?.name || '—' }} <small *ngIf="a.classId?.code">({{ a.classId.code }})</small></td>
              <td>{{ a.teacherId?.fullName || 'N/A' }}</td>
              <td><span class="badge" [attr.data-attend]="a.status">{{ attendanceLabel(a.status) }}</span></td>
              <td>{{ a.notes || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Recent transactions -->
      <div class="card full">
        <h4>💳 Giao dịch ví gần đây</h4>
        <div *ngIf="data()!.recentTransactions.length === 0" class="empty">Chưa có giao dịch</div>
        <table *ngIf="data()!.recentTransactions.length > 0" class="data-table">
          <thead><tr><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày</th></tr></thead>
          <tbody>
            <tr *ngFor="let t of data()!.recentTransactions">
              <td><span class="badge" [attr.data-type]="t.type">{{ txLabel(t.type) }}</span></td>
              <td [class.deduct]="t.type === 'SESSION_DEDUCT'" [class.credit]="t.type === 'TOP_UP' || t.type === 'REFUND' || t.type === 'TRANSFER_IN'">
                {{ isCredit(t.type) ? '+' : '-' }}{{ t.amount | number:'1.0-0' }}đ
              </td>
              <td><span class="badge" [attr.data-status]="t.status">{{ t.status }}</span></td>
              <td>{{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
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
    .card.wide { grid-column: span 2; }
    .card.full { grid-column: 1 / -1; }
    .card.highlight { border-top:4px solid; }
    .card.highlight.blue { border-color:#3b82f6; }
    .card.highlight.green { border-color:#22c55e; }
    .card.highlight.purple { border-color:#8b5cf6; }
    .card.highlight.orange { border-color:#f97316; }
    .value { font-size:28px; font-weight:700; color:#1e293b; margin-bottom:4px; }
    .card small { color:#94a3b8; }
    .children-list { display:flex; gap:12px; flex-wrap:wrap; }
    .child-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; display:flex; flex-direction:column; gap:4px; min-width:180px; }
    .child-card strong { color:#1e293b; }
    .child-card span { font-size:13px; color:#64748b; }
    .stat-row { display:flex; gap:20px; flex-wrap:wrap; }
    .stat { display:flex; flex-direction:column; align-items:center; }
    .stat .num { font-size:18px; font-weight:700; color:#1e293b; }
    .stat .lbl { font-size:12px; color:#94a3b8; margin-top:2px; }
    .status-list { display:flex; flex-direction:column; gap:6px; }
    .status-item { display:flex; justify-content:space-between; align-items:center; }
    .badge { padding:2px 8px; border-radius:99px; font-size:11px; background:#e2e8f0; color:#475569; font-weight:600; }
    .badge[data-status="ACTIVE"], .badge[data-status="FINALIZED"], .badge[data-status="COMPLETED"], .badge[data-status="APPROVED"] { background:#dcfce7; color:#16a34a; }
    .badge[data-status="SCHEDULED"], .badge[data-status="OPEN"] { background:#dbeafe; color:#2563eb; }
    .badge[data-status="CANCELLED"] { background:#fef2f2; color:#dc2626; }
    .badge[data-status="TEACHER_COMPLETED"], .badge[data-status="PENDING"], .badge[data-status="IN_PROGRESS"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-type="TOP_UP"] { background:#dbeafe; color:#2563eb; }
    .badge[data-type="SESSION_DEDUCT"] { background:#fef2f2; color:#dc2626; }
    .badge[data-type="REFUND"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-type="TRANSFER_OUT"] { background:#fed7aa; color:#9a3412; }
    .badge[data-type="TRANSFER_IN"] { background:#bbf7d0; color:#166534; }
    .badge[data-attend="PRESENT"] { background:#dcfce7; color:#16a34a; }
    .badge[data-attend="ABSENT"] { background:#fef2f2; color:#dc2626; }
    .badge[data-attend="LATE"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-attend="EXCUSED"] { background:#e2e8f0; color:#475569; }
    .count { font-weight:600; color:#1e293b; }
    .deduct { color:#dc2626; }
    .credit { color:#16a34a; }
    .green-text { color:#16a34a; }
    .red-text { color:#dc2626; }
    .mono { font-family:'Cascadia Code','Consolas',monospace; font-size:12px; }
    .center { text-align:center; }
    .right { text-align:right; }
    .bold { font-weight:600; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th { text-align:left; padding:8px; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:12px; text-transform:uppercase; }
    .data-table td { padding:8px; border-bottom:1px solid #f1f5f9; }
    .data-table small { color:#94a3b8; }
    .invoice-summary, .attendance-summary { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
    .tag { display:inline-block; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:600; }
    .green-bg { background:#dcfce7; color:#166534; }
    .blue-bg { background:#dbeafe; color:#1d4ed8; }
    .yellow-bg { background:#fef9c3; color:#92400e; }
    .red-bg { background:#fef2f2; color:#dc2626; }
    .gray-bg { background:#f1f5f9; color:#475569; }
    .empty { color:#94a3b8; font-style:italic; padding:12px 0; }
    @media (max-width:768px) { .card.wide { grid-column: span 1; } }
  `]
})
export class ParentDashboardComponent implements OnInit {
  data = signal<any>(null);
  loading = signal(false);
  error = signal('');

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.dashboardService.getParentDashboard();
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

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Đã lên lịch', TEACHER_COMPLETED: 'GV xác nhận',
      PARENT_CONFIRMED: 'PH xác nhận', FINALIZED: 'Hoàn tất',
      CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng', RESCHEDULED: 'Dời lịch',
    };
    return map[s] || s;
  }

  txLabel(type: string): string {
    const map: Record<string, string> = {
      TOP_UP: 'Nạp tiền', SESSION_DEDUCT: 'Trừ buổi học',
      REFUND: 'Hoàn tiền', ADJUSTMENT: 'Điều chỉnh', BONUS: 'Thưởng',
      TRANSFER_OUT: 'Chuyển đi', TRANSFER_IN: 'Nhận chuyển',
    };
    return map[type] || type;
  }

  invoiceStatusLabel(s: string): string {
    const map: Record<string, string> = {
      PAID: 'Đã thanh toán', PENDING: 'Chờ xử lý', CANCELLED: 'Đã hủy',
    };
    return map[s] || s;
  }

  attendanceLabel(s: string): string {
    const map: Record<string, string> = {
      PRESENT: 'Có mặt', ABSENT: 'Vắng',
      LATE: 'Đi muộn', EXCUSED: 'Xin phép',
    };
    return map[s] || s;
  }

  isCredit(type: string): boolean {
    return ['TOP_UP', 'REFUND', 'TRANSFER_IN', 'BONUS'].includes(type);
  }
}
