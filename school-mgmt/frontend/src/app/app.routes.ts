import { Routes } from '@angular/router';
import { LoginComponent } from './components/login.component';
import { AppShellComponent } from './components/app-shell.component';
import { UsersManagementComponent } from './components/users-management.component';
import { NotAuthorizedComponent } from './components/not-authorized.component';
import { ProductsComponent } from './components/products.component';
import { ClassesComponent } from './components/classes.component';
import { AttendanceComponent } from './components/attendance.component';
import { AttendanceReportComponent } from './components/attendance-report.component';
import { StudentReportComponent } from './components/student-report.component';
import { StudentAttendanceComponent } from './components/student-attendance.component';
import { InvoicesComponent } from './components/invoices.component';
import { StudentsComponent } from './components/students.component';
import { ClassroomStatusComponent } from './components/classroom-status.component';
import { TeachingReportComponent } from './components/teaching-report.component';
import { DataManagementComponent } from './components/data-management.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'not-authorized', component: NotAuthorizedComponent },
	{ path: 'student-attendance/:token', component: StudentAttendanceComponent },
	{
		path: 'app',
		component: AppShellComponent,
		canActivate: [authGuard],
		children: [
			{ path: 'users', component: UsersManagementComponent, canActivate: [roleGuard(['DIRECTOR'])] },
			{ path: 'products', component: ProductsComponent, canActivate: [roleGuard(['DIRECTOR'])] },
				{ path: 'students', component: StudentsComponent, canActivate: [roleGuard(['DIRECTOR','SALE','TEACHER'])] },
			{ path: 'classes', component: ClassesComponent, canActivate: [roleGuard(['DIRECTOR','SALE','TEACHER'])] },
			{ path: 'attendance', component: AttendanceComponent },
			{ path: 'attendance-report', component: AttendanceReportComponent },
      { path: 'teaching-report', component: TeachingReportComponent, canActivate: [roleGuard(['DIRECTOR','TEACHER'])] },
			{ path: 'student-report', component: StudentReportComponent },
			{ path: 'invoices', component: InvoicesComponent, canActivate: [roleGuard(['DIRECTOR','SALE'])] },
			{ path: 'classroom-status', component: ClassroomStatusComponent, canActivate: [roleGuard(['DIRECTOR','SALE'])] },
			{ path: 'data-management', component: DataManagementComponent, canActivate: [roleGuard(['DIRECTOR','SALE','TEACHER'])] },
			{ path: '', pathMatch: 'full', redirectTo: 'classes' }
		]
	},
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' }
];
