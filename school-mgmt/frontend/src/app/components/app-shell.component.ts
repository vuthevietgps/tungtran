import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { AttendanceService, TeacherClassAssignment } from '../services/attendance.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
  <div class="layout" [class.collapsed]="sidebarCollapsed">
    <aside class="sidebar" [class.collapsed]="sidebarCollapsed">
      <button type="button" class="toggle" (click)="toggleSidebar()">{{ sidebarCollapsed ? '>>' : '<<' }}</button>
      <h3 *ngIf="!sidebarCollapsed">Chức năng</h3>
      <nav *ngIf="!isTeacher(); else teacherNav">
        <a routerLink="/app/users" routerLinkActive="active" *ngIf="isDirector()" title="Quản lý User"><span class="label">Quản lý User</span></a>
        <a routerLink="/app/products" routerLinkActive="active" *ngIf="isDirector()" title="Quản lý Khóa học"><span class="label">Quản lý Khóa học</span></a>
        <a routerLink="/app/students" routerLinkActive="active" title="Quản lý Học sinh"><span class="label">Quản lý Học sinh</span></a>
        <a routerLink="/app/classes" routerLinkActive="active" title="Quản lý Lớp học"><span class="label">Quản lý Lớp học</span></a>
        <a routerLink="/app/invoices" routerLinkActive="active" *ngIf="canManageInvoices()" title="Quản lý Hóa đơn"><span class="label">Quản lý Hóa đơn</span></a>
        <a routerLink="/app/classroom-status" routerLinkActive="active" *ngIf="canManageOrders()" title="Trạng thái lớp học"><span class="label">Trạng thái lớp học</span></a>
        <a routerLink="/app/attendance" routerLinkActive="active" title="Điểm danh"><span class="label">Điểm danh</span></a>
        <a routerLink="/app/attendance-report" routerLinkActive="active" title="Báo cáo điểm danh"><span class="label">Báo cáo điểm danh</span></a>
        <a routerLink="/app/student-report" routerLinkActive="active" title="Báo cáo học sinh"><span class="label">Báo cáo học sinh</span></a>
        <a routerLink="/app/teaching-report" routerLinkActive="active" *ngIf="canAccessTeachingReport()" title="Báo cáo giảng dạy"><span class="label">Báo cáo giảng dạy</span></a>
        <a routerLink="/app/data-management" routerLinkActive="active" *ngIf="canAccessData()" title="Quản lý Data"><span class="label">Quản lý Data</span></a>
      </nav>
      <ng-template #teacherNav>
        <div class="teacher-nav">
          <p class="helper" *ngIf="!sidebarCollapsed">Lối tắt dành cho giáo viên</p>
          <a routerLink="/app/classes" routerLinkActive="active" title="Lớp tôi phụ trách" class="nav-pill"><span class="label">Lớp Tôi Phụ Trách</span></a>

          <div class="dropdown" [class.open]="attendanceMenuOpen">
            <button type="button" class="dropdown-toggle nav-pill" (click)="toggleAttendanceMenu()">
              <span class="label">Điểm Danh</span>
              <span class="chevron">{{ attendanceMenuOpen ? '▾' : '▸' }}</span>
            </button>
            <div class="dropdown-panel" *ngIf="attendanceMenuOpen">
              <ng-container *ngIf="teacherClasses.length; else noClassAssigned">
                <a
                  *ngFor="let cls of teacherClasses"
                  [routerLink]="['/app/attendance']"
                  [queryParams]="{ classId: cls.classId }"
                  routerLinkActive="active"
                  title="Điểm danh lớp {{cls.classCode}}"
                  class="child-link"
                >
                  <span class="label">{{cls.classCode}} - {{cls.className}}</span>
                </a>
              </ng-container>
              <ng-template #noClassAssigned>
                <div class="muted">Chưa được phân lớp</div>
              </ng-template>
            </div>
          </div>

          <a routerLink="/app/attendance-report" routerLinkActive="active" title="Báo cáo điểm danh" class="nav-pill"><span class="label">Báo Cáo Điểm Danh</span></a>
          <a routerLink="/app/teaching-report" routerLinkActive="active" title="Báo cáo giảng dạy" class="nav-pill"><span class="label">Báo Cáo Giảng Dạy</span></a>
        </div>
      </ng-template>
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
    nav a.active, nav a:hover { background:#0e1b33; border-color:#6ee7ff; color:#e0f2fe; box-shadow:0 0 0 1px rgba(110,231,255,0.35); }
    .nav-pill { background:#0a1426; border:1px solid #1f3b63; box-shadow:0 6px 16px rgba(0,0,0,0.25); }
    .teacher-nav { display:flex; flex-direction:column; gap:10px; margin-top:24px; width:100%; }
    .teacher-nav .helper { margin:0 0 6px 0; color:var(--muted); font-size:12px; }
    .dropdown { width:100%; }
    .dropdown-toggle { width:100%; display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:10px; border:1px solid #1f3b63; background:#0a1426; color:var(--text); cursor:pointer; box-shadow:0 6px 16px rgba(0,0,0,0.25); }
    .dropdown-toggle .chevron { font-size:12px; }
    .dropdown-panel { display:flex; flex-direction:column; gap:6px; padding:10px; background:#0c1a33; border:1px solid #1f3b63; border-radius:10px; margin-top:8px; box-shadow:0 10px 28px rgba(0,0,0,0.35); }
    .dropdown-panel a { justify-content:flex-start; padding:8px 10px; margin:0; border:1px solid transparent; border-radius:8px; background:#0f2344; color:var(--text); }
    .dropdown-panel a:hover { background:#132544; border-color:#6ee7ff; color:#e0f2fe; }
    .child-link { font-size:13px; }
    .dropdown .muted { color:var(--muted); font-size:12px; }
    .content { flex:1; padding:24px; background:var(--surface); }
    .logout { margin-top:auto; padding:10px 12px; border:1px solid var(--border); border-radius:8px; background:var(--danger); color:#fff; cursor:pointer; }
    .logout.compact { width:40px; height:40px; padding:0; font-size:0; position:relative; }
    .logout.compact::after { content:'Off'; font-size:11px; color:#fff; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
    .user-info { margin-top:auto; margin-bottom:12px; font-size:13px; text-align:left; }
    .layout.collapsed .content { padding-left:16px; }
  `]
})
export class AppShellComponent implements OnInit {
  sidebarCollapsed = false;
  attendanceMenuOpen = false;
  teacherClasses: TeacherClassAssignment[] = [];
  teacherClassesLoading = false;

  constructor(public auth: AuthService, private attendanceService: AttendanceService) {}

  async ngOnInit(): Promise<void> {
    if (this.isTeacher()) {
      await this.loadTeacherClasses();
    }
  }

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

  canAccessData(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'SALE' || role === 'TEACHER';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleAttendanceMenu(): void {
    this.attendanceMenuOpen = !this.attendanceMenuOpen;
    if (this.attendanceMenuOpen && !this.teacherClasses.length && !this.teacherClassesLoading) {
      void this.loadTeacherClasses();
    }
  }

  private async loadTeacherClasses(): Promise<void> {
    this.teacherClassesLoading = true;
    try {
      this.teacherClasses = await this.attendanceService.getTeacherClasses();
    } catch (err) {
      console.error('Không thể tải danh sách lớp của giáo viên', err);
    } finally {
      this.teacherClassesLoading = false;
    }
  }
}
