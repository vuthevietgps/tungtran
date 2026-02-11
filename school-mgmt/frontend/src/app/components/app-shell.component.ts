import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { NotificationsService } from '../services/notifications.service';
import { PendingApprovalsService } from '../services/pending-approvals.service';
import { Role, ROLE_LABELS } from '../models/role.enum';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
  <div class="layout" [class.collapsed]="sidebarCollapsed">
    <aside class="sidebar" [class.collapsed]="sidebarCollapsed">
      <button type="button" class="toggle" (click)="toggleSidebar()">{{ sidebarCollapsed ? '&#9776;' : '&laquo;' }}</button>
      <h3 *ngIf="!sidebarCollapsed">Chức năng</h3>
      <nav>
        <!-- Dashboard (all roles) -->
        <a routerLink="/app/dashboard" routerLinkActive="active" title="Dashboard">
          <span class="icon">&#9632;</span><span class="label">Dashboard</span>
        </a>

        <!-- Director: Pending Approvals -->
        <a routerLink="/app/pending-approvals" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Chờ duyệt">
          <span class="icon">&#128203;</span><span class="label">Chờ duyệt</span>
          <span class="nav-badge" *ngIf="pendingCount > 0">{{ pendingCount }}</span>
        </a>

        <!-- Notifications -->
        <a routerLink="/app/notifications" routerLinkActive="active" title="Thông báo">
          <span class="icon">&#128276;</span><span class="label">Thông báo</span>
          <span class="nav-badge" *ngIf="unreadNotifCount > 0">{{ unreadNotifCount }}</span>
        </a>

        <!-- Director -->
        <a routerLink="/app/users" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Quản lý User">
          <span class="icon">&#128100;</span><span class="label">Quản lý User</span>
        </a>
        <a routerLink="/app/products" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Quản lý Khóa học">
          <span class="icon">&#128218;</span><span class="label">Quản lý Khóa học</span>
        </a>

        <!-- Sales / CRM -->
        <a routerLink="/app/leads" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.SALE])" title="KH tiềm năng">
          <span class="icon">&#128161;</span><span class="label">KH tiềm năng</span>
        </a>
        <a routerLink="/app/orders" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.SALE])" title="Đơn đăng ký">
          <span class="icon">&#128203;</span><span class="label">Đơn đăng ký</span>
        </a>

        <a routerLink="/app/teacher-kpi" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="KPI Giáo viên">
          <span class="icon">&#127942;</span><span class="label">KPI Giáo viên</span>
        </a>
        <a routerLink="/app/calendar-overview" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Lịch tổng quan">
          <span class="icon">&#128197;</span><span class="label">Lịch tổng quan</span>
        </a>
        <a routerLink="/app/teacher-profiles" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Hồ sơ giáo viên">
          <span class="icon">&#128101;</span><span class="label">Hồ sơ giáo viên</span>
        </a>

        <!-- OPS -->
        <a routerLink="/app/students" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE])" title="Quản lý Học sinh">
          <span class="icon">&#127891;</span><span class="label">Quản lý Học sinh</span>
        </a>
        <a routerLink="/app/classes" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.SALE])" title="Quản lý Lớp học">
          <span class="icon">&#127979;</span><span class="label">Quản lý Lớp học</span>
        </a>
        <a routerLink="/app/sessions" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.PARENT, Role.ACCOUNTING])" title="Buổi học">
          <span class="icon">&#128197;</span><span class="label">Buổi học</span>
        </a>

        <!-- Accounting -->
        <a routerLink="/app/invoices" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE])" title="Quản lý Hóa đơn">
          <span class="icon">&#128196;</span><span class="label">Quản lý Hóa đơn</span>
        </a>
        <a routerLink="/app/wallets" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.PARENT])" title="Quản lý Ví">
          <span class="icon">&#128176;</span><span class="label">Quản lý Ví</span>
        </a>
        <a routerLink="/app/payroll" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER])" title="Thanh toán lương">
          <span class="icon">&#128181;</span><span class="label">Thanh toán lương</span>
        </a>

        <!-- Teaching ops -->
        <a routerLink="/app/attendance" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER])" title="Điểm danh">
          <span class="icon">&#9745;</span><span class="label">Điểm danh</span>
        </a>
        <a routerLink="/app/attendance-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER])" title="BC Điểm danh">
          <span class="icon">&#128202;</span><span class="label">BC Điểm danh</span>
        </a>
        <a routerLink="/app/student-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING])" title="BC Học sinh">
          <span class="icon">&#128203;</span><span class="label">BC Học sinh</span>
        </a>
        <a routerLink="/app/comprehensive-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING])" title="BC Tổng hợp">
          <span class="icon">&#128200;</span><span class="label">BC Tổng hợp</span>
        </a>
        <a routerLink="/app/teaching-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.TEACHER])" title="BC Giảng dạy">
          <span class="icon">&#128221;</span><span class="label">BC Giảng dạy</span>
        </a>
        <a routerLink="/app/teaching-materials" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER])" title="Tài liệu giảng dạy">
          <span class="icon">&#128194;</span><span class="label">Tài liệu GD</span>
        </a>
        <a routerLink="/app/teacher-profile" routerLinkActive="active" *ngIf="hasRole([Role.TEACHER])" title="Hồ sơ giảng dạy">
          <span class="icon">&#128100;</span><span class="label">Hồ sơ cá nhân</span>
        </a>

        <!-- Tickets (all roles) -->
        <a routerLink="/app/tickets" routerLinkActive="active" title="Hỗ trợ & Ticket">
          <span class="icon">&#127915;</span><span class="label">Hỗ trợ & Ticket</span>
        </a>

        <!-- Export Reports -->
        <a routerLink="/app/export-reports" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])" title="Xuất báo cáo">
          <span class="icon">&#128230;</span><span class="label">Xuất báo cáo</span>
        </a>

        <!-- Audit Log -->
        <a routerLink="/app/audit-log" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Nhật ký">
          <span class="icon">&#128270;</span><span class="label">Nhật ký HĐ</span>
        </a>
      </nav>
      <div class="user-info" *ngIf="!sidebarCollapsed">
        <div class="user-name">{{ auth.userSignal()?.fullName }}</div>
        <small class="user-role">{{ getRoleLabel(auth.userSignal()?.role) }}</small>
      </div>
      <button class="logout" (click)="auth.logout()" [class.compact]="sidebarCollapsed">
        {{ sidebarCollapsed ? '&#10140;' : 'Đăng xuất' }}
      </button>
    </aside>
    <main class="content">
      <router-outlet></router-outlet>
    </main>
  </div>
  `,
  styles: [`
    .layout { display:flex; min-height:100vh; background:#e2e8f0; font-family:'Segoe UI',sans-serif; }
    .sidebar {
      width:230px; background:#0f172a; color:#e2e8f0; padding:16px;
      display:flex; flex-direction:column; position:relative; transition:width 0.2s ease;
      overflow-y:auto;
    }
    .sidebar.collapsed { width:60px; align-items:center; padding:16px 8px; }
    .toggle {
      position:absolute; top:12px; right:12px; border:none; background:#1e293b;
      color:#e2e8f0; border-radius:999px; width:32px; height:32px; cursor:pointer;
      font-size:14px; display:flex; align-items:center; justify-content:center;
    }
    .sidebar.collapsed .toggle { position:static; margin-bottom:12px; }
    .sidebar h3 { margin:44px 0 0; font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; }
    nav { margin-top:16px; width:100%; flex:1; }
    nav a {
      display:flex; align-items:center; gap:10px; padding:9px 12px; margin-bottom:2px;
      text-decoration:none; border-radius:6px; color:#cbd5e1; font-size:13px;
      transition:background 0.15s, color 0.15s;
    }
    nav a:hover { background:#1e293b; color:#f1f5f9; }
    nav a.active { background:#2563eb; color:#fff; font-weight:600; }
    .icon { font-size:16px; min-width:20px; text-align:center; }
    .sidebar.collapsed .label { display:none; }
    .sidebar.collapsed nav a { justify-content:center; padding:10px; }
    .nav-badge {
      margin-left:auto; background:#dc2626; color:#fff; border-radius:999px;
      font-size:10px; padding:1px 6px; font-weight:700; min-width:16px; text-align:center;
    }
    .sidebar.collapsed .nav-badge { display:none; }
    .user-info { margin-top:auto; padding:12px 0; border-top:1px solid #1e293b; }
    .user-name { font-weight:600; font-size:14px; }
    .user-role { color:#94a3b8; font-size:12px; }
    .logout {
      margin-top:8px; padding:8px 12px; border:none; border-radius:6px;
      background:#dc2626; color:#fff; cursor:pointer; font-size:13px; font-weight:600;
      transition:background 0.15s;
    }
    .logout:hover { background:#b91c1c; }
    .logout.compact { padding:8px; font-size:16px; }
    .content { flex:1; overflow-y:auto; }
  `]
})
export class AppShellComponent {
  Role = Role;
  sidebarCollapsed = false;
  unreadNotifCount = 0;
  pendingCount = 0;

  private notifSvc = inject(NotificationsService);
  private pendingSvc = inject(PendingApprovalsService);
  private refreshInterval: any;

  constructor(public auth: AuthService) {}

  ngOnInit() {
    this.loadCounts();
    this.refreshInterval = setInterval(() => this.loadCounts(), 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  async loadCounts() {
    try {
      const { count } = await this.notifSvc.getUnreadCount();
      this.unreadNotifCount = count;
    } catch {}
    if (this.hasRole([Role.DIRECTOR])) {
      try {
        const summary = await this.pendingSvc.getSummary();
        this.pendingCount = summary.totalPending || 0;
      } catch {}
    }
  }

  hasRole(roles: Role[]): boolean {
    const userRole = this.auth.userSignal()?.role;
    if (!userRole) return false;
    return roles.includes(userRole as Role);
  }

  getRoleLabel(role?: string): string {
    return role ? (ROLE_LABELS[role] || role) : '';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
