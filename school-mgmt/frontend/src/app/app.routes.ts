import { Routes } from '@angular/router';
import { LoginComponent } from './components/login.component';
import { AppShellComponent } from './components/app-shell.component';
import { UsersManagementComponent } from './components/users-management.component';
import { NotAuthorizedComponent } from './components/not-authorized.component';
import { ProductsComponent } from './components/products.component';
import { ClassesComponent } from './components/classes.component';
import { StudentsComponent } from './components/students.component';
import { AttendanceComponent } from './components/attendance.component';
import { AttendanceReportComponent } from './components/attendance-report.component';
import { StudentReportComponent } from './components/student-report.component';
import { ComprehensiveReportComponent } from './components/comprehensive-report.component';
import { StudentAttendanceComponent } from './components/student-attendance.component';
import { InvoicesComponent } from './components/invoices.component';
import { SessionsComponent } from './components/sessions.component';
import { WalletsComponent } from './components/wallets.component';
import { TeachingReportComponent } from './components/teaching-report.component';
import { DashboardComponent } from './components/dashboards/dashboard.component';
import { PayrollComponent } from './components/payroll.component';
import { TicketsComponent } from './components/tickets.component';
import { TeacherProfileComponent } from './components/teacher-profile.component';
import { TeachingMaterialsComponent } from './components/teaching-materials.component';
import { PendingApprovalsComponent } from './components/pending-approvals.component';
import { NotificationsComponent } from './components/notifications.component';
import { AuditLogComponent } from './components/audit-log.component';
import { ExportReportsComponent } from './components/export-reports.component';
import { TeacherKpiComponent } from './components/teacher-kpi.component';
import { CalendarOverviewComponent } from './components/calendar-overview.component';
import { TeacherProfilesComponent } from './components/teacher-profiles.component';
import { LeadsComponent } from './components/leads.component';
import { OrdersComponent } from './components/orders.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { Role } from './models/role.enum';

export const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'not-authorized', component: NotAuthorizedComponent },
	{ path: 'student-attendance/:token', component: StudentAttendanceComponent },
	{
		path: 'app',
		component: AppShellComponent,
		canActivate: [authGuard],
		children: [
			{ path: 'dashboard', component: DashboardComponent },
			{ path: 'users', component: UsersManagementComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'products', component: ProductsComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'students', component: StudentsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE])] },
			{ path: 'classes', component: ClassesComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.SALE])] },
			{ path: 'sessions', component: SessionsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.PARENT, Role.ACCOUNTING])] },
			{ path: 'attendance', component: AttendanceComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER])] },
			{ path: 'attendance-report', component: AttendanceReportComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER])] },
			{ path: 'student-report', component: StudentReportComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING])] },
			{ path: 'comprehensive-report', component: ComprehensiveReportComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING])] },
			{ path: 'teaching-report', component: TeachingReportComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.TEACHER])] },
			{ path: 'invoices', component: InvoicesComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE])] },

			{ path: 'wallets', component: WalletsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.PARENT])] },
			{ path: 'payroll', component: PayrollComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER])] },
			{ path: 'tickets', component: TicketsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER, Role.PARENT])] },
			{ path: 'teacher-profile', component: TeacherProfileComponent, canActivate: [roleGuard([Role.TEACHER])] },
			{ path: 'teaching-materials', component: TeachingMaterialsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER])] },
			{ path: 'pending-approvals', component: PendingApprovalsComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'notifications', component: NotificationsComponent },
			{ path: 'audit-log', component: AuditLogComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'export-reports', component: ExportReportsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])] },
			{ path: 'teacher-kpi', component: TeacherKpiComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'calendar-overview', component: CalendarOverviewComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'teacher-profiles', component: TeacherProfilesComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'teacher-profiles/:id', component: TeacherProfilesComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'leads', component: LeadsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])] },
			{ path: 'orders', component: OrdersComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])] },
			{ path: '', pathMatch: 'full', redirectTo: 'dashboard' }
		]
	},
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' }
];
