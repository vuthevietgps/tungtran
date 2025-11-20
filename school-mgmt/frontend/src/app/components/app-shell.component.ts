import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
  <div class="layout">
    <aside class="sidebar">
      <h3>Chức năng</h3>
      <nav>
        <a routerLink="/app/users" routerLinkActive="active">Quản lý User</a>
        <a routerLink="/app/products" routerLinkActive="active">Quản lý Sản phẩm</a>
        <a routerLink="/app/students" routerLinkActive="active">Quản lý Học sinh</a>
        <a routerLink="/app/classes" routerLinkActive="active">Quản lý Lớp học</a>
      </nav>
      <div class="user-info">
        <div>{{auth.userSignal()?.fullName}}</div>
        <small>{{auth.userSignal()?.role}}</small>
      </div>
      <button class="logout" (click)="auth.logout()">Đăng xuất</button>
    </aside>
    <main class="content">
      <router-outlet></router-outlet>
    </main>
  </div>
  `,
  styles: [`
    .layout { display:flex; min-height:100vh; background:#e2e8f0; font-family:'Segoe UI',sans-serif; }
    .sidebar { width:220px; background:#0f172a; color:#e2e8f0; padding:16px; display:flex; flex-direction:column; }
    .sidebar h3 { margin-top:0; }
    nav a { display:block; padding:8px 10px; margin-bottom:4px; text-decoration:none; border-radius:4px; color:#cbd5f5; }
    nav a.active, nav a:hover { background:#1e293b; color:#fff; }
    .content { flex:1; padding:24px; background:#f8fafc; }
    .logout { margin-top:auto; padding:8px 12px; border:none; border-radius:4px; background:#dc2626; color:#fff; cursor:pointer; }
    .user-info { margin-top:auto; margin-bottom:12px; font-size:13px; }
  `]
})
export class AppShellComponent {
  constructor(public auth: AuthService) {}
}
