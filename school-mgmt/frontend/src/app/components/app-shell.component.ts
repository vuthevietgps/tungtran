import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
  <div class="layout" [class.collapsed]="sidebarCollapsed">
    <aside class="sidebar" [class.collapsed]="sidebarCollapsed">
      <button type="button" class="toggle" (click)="toggleSidebar()">{{ sidebarCollapsed ? '>>' : '<<' }}</button>
      <h3 *ngIf="!sidebarCollapsed">Chức năng</h3>
      <nav>
        <a routerLink="/app/users" routerLinkActive="active" *ngIf="isDirector()" title="Quản lý User"><span class="label">Quản lý User</span></a>
        <a routerLink="/app/products" routerLinkActive="active" *ngIf="isDirector()" title="Quản lý Khóa học"><span class="label">Quản lý Khóa học</span></a>
        <a routerLink="/app/students" routerLinkActive="active" title="Quản lý Học sinh"><span class="label">Quản lý Học sinh</span></a>
        <a routerLink="/app/classes" routerLinkActive="active" title="Quản lý Lớp học"><span class="label">Quản lý Lớp học</span></a>
        <a routerLink="/app/invoices" routerLinkActive="active" *ngIf="canManageInvoices()" title="Quản lý Hóa đơn"><span class="label">Quản lý Hóa đơn</span></a>
        <a routerLink="/app/orders" routerLinkActive="active" *ngIf="canManageOrders()" title="Quản lý Đơn hàng"><span class="label">Quản lý Đơn hàng</span></a>
        <a routerLink="/app/classroom-status" routerLinkActive="active" *ngIf="canManageOrders()" title="Trạng thái lớp học"><span class="label">Trạng thái lớp học</span></a>
        <a routerLink="/app/attendance" routerLinkActive="active" title="Điểm danh"><span class="label">Điểm danh</span></a>
        <a routerLink="/app/attendance-report" routerLinkActive="active" title="Báo cáo điểm danh"><span class="label">Báo cáo điểm danh</span></a>
        <a routerLink="/app/student-report" routerLinkActive="active" title="Báo cáo học sinh"><span class="label">Báo cáo học sinh</span></a>
        <a routerLink="/app/teaching-report" routerLinkActive="active" *ngIf="canAccessTeachingReport()" title="Báo cáo giảng dạy"><span class="label">Báo cáo giảng dạy</span></a>
      </nav>
      <div class="user-info" *ngIf="!sidebarCollapsed">
        <div>{{auth.userSignal()?.fullName}}</div>
        <small>{{auth.userSignal()?.role}}</small>
      </div>
      <button class="logout" (click)="auth.logout()" [class.compact]="sidebarCollapsed">Đăng xuất</button>
    </aside>
    <main class="content">
      <router-outlet></router-outlet>
    </main>
  </div>
  `,
  styles: [`
    .layout { display:flex; min-height:100vh; background:var(--bg); color:var(--text); font-family:'Segoe UI',sans-serif; }
    .sidebar { width:220px; min-width:220px; background:var(--panel); color:var(--text); padding:16px; display:flex; flex-direction:column; position:relative; transition:width 0.2s ease; border-right:1px solid var(--border); }
    .sidebar.collapsed { width:68px; align-items:center; }
    .toggle { position:absolute; top:12px; right:12px; border:1px solid var(--border); background:#132544; color:var(--text); border-radius:999px; width:36px; height:36px; cursor:pointer; font-size:16px; }
    .sidebar.collapsed .toggle { right:16px; }
    .sidebar h3 { margin-top:44px; }
    .sidebar.collapsed h3 { display:none; }
    nav { margin-top:24px; width:100%; }
    nav a { display:flex; align-items:center; justify-content:center; padding:10px 12px; margin-bottom:6px; text-decoration:none; border-radius:8px; color:var(--text); transition:background 0.15s ease, border-color 0.15s ease; white-space:nowrap; border:1px solid transparent; }
    nav a .label { white-space:nowrap; }
    .sidebar:not(.collapsed) nav a { justify-content:flex-start; }
    .sidebar.collapsed nav a .label { display:none; }
    nav a.active, nav a:hover { background:#132544; border-color:var(--border); color:#a5f3fc; }
    .content { flex:1; padding:24px; background:var(--surface); }
    .logout { margin-top:auto; padding:10px 12px; border:1px solid var(--border); border-radius:8px; background:var(--danger); color:#fff; cursor:pointer; }
    .logout.compact { width:40px; height:40px; padding:0; font-size:0; position:relative; }
    .logout.compact::after { content:'Off'; font-size:11px; color:#fff; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
    .user-info { margin-top:auto; margin-bottom:12px; font-size:13px; text-align:left; }
    .layout.collapsed .content { padding-left:16px; }
  `]
})
export class AppShellComponent {
  sidebarCollapsed = false;

  constructor(public auth: AuthService) {}

  isDirector(): boolean {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }

  isTeacher(): boolean {
    return this.auth.userSignal()?.role === 'TEACHER';
  }

  isSale(): boolean {
    return this.auth.userSignal()?.role === 'SALE';
  }

  canManageInvoices(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'SALE';
  }

  canManageOrders(): boolean {
    return this.canManageInvoices();
  }

  canAccessTeachingReport(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'TEACHER';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
