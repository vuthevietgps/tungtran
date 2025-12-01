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
        <a routerLink="/app/attendance" routerLinkActive="active" title="Điểm danh"><span class="label">Điểm danh</span></a>
        <a routerLink="/app/attendance-report" routerLinkActive="active" title="Báo cáo điểm danh"><span class="label">Báo cáo điểm danh</span></a>
        <a routerLink="/app/student-report" routerLinkActive="active" title="Báo cáo học sinh"><span class="label">Báo cáo học sinh</span></a>
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
    .layout { display:flex; min-height:100vh; background:#e2e8f0; font-family:'Segoe UI',sans-serif; }
    .sidebar { width:220px; background:#0f172a; color:#e2e8f0; padding:16px; display:flex; flex-direction:column; position:relative; transition:width 0.2s ease; }
    .sidebar.collapsed { width:68px; align-items:center; }
    .toggle { position:absolute; top:12px; right:12px; border:none; background:#1e293b; color:#e2e8f0; border-radius:999px; width:36px; height:36px; cursor:pointer; font-size:16px; }
    .sidebar.collapsed .toggle { right:16px; }
    .sidebar h3 { margin-top:44px; }
    .sidebar.collapsed h3 { display:none; }
    nav { margin-top:24px; width:100%; }
    nav a { display:flex; align-items:center; justify-content:center; padding:8px 10px; margin-bottom:4px; text-decoration:none; border-radius:4px; color:#cbd5f5; transition:background 0.15s ease; }
    .sidebar:not(.collapsed) nav a { justify-content:flex-start; }
    .sidebar.collapsed nav a .label { display:none; }
    nav a.active, nav a:hover { background:#1e293b; color:#fff; }
    .content { flex:1; padding:24px; background:#f8fafc; }
    .logout { margin-top:auto; padding:8px 12px; border:none; border-radius:4px; background:#dc2626; color:#fff; cursor:pointer; }
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

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
