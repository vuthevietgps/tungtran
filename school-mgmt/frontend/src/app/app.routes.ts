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
import { ExpensesComponent } from './components/expenses.component';
import { FinancialControlComponent } from './components/financial-control.component';
import { LoansComponent } from './components/loans.component';
import { AdsManagementComponent } from './components/ads-management.component';
import { AdsAnalyticsComponent } from './components/ads-analytics.component';
import { ChatbotSettingsComponent } from './components/chatbot-settings.component';
import { ConversationsComponent } from './components/conversations.component';
import { WorkSessionsComponent } from './components/work-sessions.component';
import { SalaryConfigComponent } from './components/salary-config.component';
import { StaffPayrollComponent } from './components/staff-payroll.component';
import { StudentProgressComponent } from './components/student-progress.component';
import { ParentAttendanceComponent } from './components/parent-attendance.component';
import { ParentInvoicesComponent } from './components/parent-invoices.component';
import { CommissionReportComponent } from './components/commission-report.component';
import { AgingReportComponent } from './components/aging-report.component';
import { ParentCalendarComponent } from './components/parent-calendar.component';
import { TeacherCalendarComponent } from './components/teacher-calendar.component';
import { TeacherSubstituteRequestComponent } from './components/teacher-substitute-request.component';
import { EmployeePerformanceComponent } from './components/employee-performance.component';
import { BankReconciliationComponent } from './components/bank-reconciliation.component';
import { MessagesComponent } from './components/messages.component';
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
			{ path: 'teaching-report', component: TeachingReportComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.TEACHER, Role.ACCOUNTING])] },
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
			{ path: 'teacher-profiles', component: TeacherProfilesComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])] },
			{ path: 'teacher-profiles/:id', component: TeacherProfilesComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])] },
			{ path: 'leads', component: LeadsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])] },
			{ path: 'orders', component: OrdersComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])] },
			{ path: 'work-sessions', component: WorkSessionsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER, Role.SALE])] },
			{ path: 'salary-config', component: SalaryConfigComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])] },
			{ path: 'staff-payroll', component: StaffPayrollComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS])] },
			{ path: 'expenses', component: ExpensesComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS])] },
			{ path: 'loans', component: LoansComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])] },
			{ path: 'financial-control', component: FinancialControlComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])] },
			{ path: 'ads-management', component: AdsManagementComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS])] },
			{ path: 'ads-analytics', component: AdsAnalyticsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS])] },
			{ path: 'conversations', component: ConversationsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])] },
			{ path: 'chatbot-settings', component: ChatbotSettingsComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.OPS])] },
			{ path: 'student-progress', component: StudentProgressComponent, canActivate: [roleGuard([Role.PARENT])] },
			{ path: 'parent-attendance', component: ParentAttendanceComponent, canActivate: [roleGuard([Role.PARENT])] },
			{ path: 'parent-invoices', component: ParentInvoicesComponent, canActivate: [roleGuard([Role.PARENT])] },
			{ path: 'commission-report', component: CommissionReportComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.SALE, Role.ACCOUNTING])] },
			{ path: 'aging-report', component: AgingReportComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])] },
			{ path: 'parent-calendar', component: ParentCalendarComponent, canActivate: [roleGuard([Role.PARENT])] },
			{ path: 'teacher-calendar', component: TeacherCalendarComponent, canActivate: [roleGuard([Role.TEACHER])] },
			{ path: 'teacher-substitute-request', component: TeacherSubstituteRequestComponent, canActivate: [roleGuard([Role.TEACHER])] },
			{ path: 'employee-performance', component: EmployeePerformanceComponent, canActivate: [roleGuard([Role.DIRECTOR])] },
			{ path: 'bank-reconciliation', component: BankReconciliationComponent, canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])] },
			{ path: 'messages', component: MessagesComponent },
			{ path: '', pathMatch: 'full', redirectTo: 'dashboard' }
		]
	},
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' }
];
