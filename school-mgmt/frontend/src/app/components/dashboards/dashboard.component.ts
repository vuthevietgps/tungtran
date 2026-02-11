import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Role } from '../../models/role.enum';
import { DirectorDashboardComponent } from './director-dashboard.component';
import { AccountingDashboardComponent } from './accounting-dashboard.component';
import { OpsDashboardComponent } from './ops-dashboard.component';
import { TeacherDashboardComponent } from './teacher-dashboard.component';
import { ParentDashboardComponent } from './parent-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DirectorDashboardComponent,
    AccountingDashboardComponent,
    OpsDashboardComponent,
    TeacherDashboardComponent,
    ParentDashboardComponent,
  ],
  template: `
    <app-director-dashboard *ngIf="role === 'DIRECTOR'" />
    <app-accounting-dashboard *ngIf="role === 'ACCOUNTING'" />
    <app-ops-dashboard *ngIf="role === 'OPS'" />
    <app-teacher-dashboard *ngIf="role === 'TEACHER'" />
    <app-parent-dashboard *ngIf="role === 'PARENT'" />
    <div *ngIf="!role" class="no-role">
      <p>Không xác định được vai trò. Vui lòng đăng nhập lại.</p>
    </div>
  `,
  styles: [`
    .no-role { padding:40px; text-align:center; color:#64748b; }
  `]
})
export class DashboardComponent {
  role: string | undefined;

  constructor(private auth: AuthService) {
    this.role = this.auth.userSignal()?.role;
  }
}
