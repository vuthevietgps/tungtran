import { Routes } from '@angular/router';
import { LoginComponent } from './components/login.component';
import { AppShellComponent } from './components/app-shell.component';
import { UsersManagementComponent } from './components/users-management.component';
import { NotAuthorizedComponent } from './components/not-authorized.component';
import { ProductsComponent } from './components/products.component';
import { StudentsComponent } from './components/students.component';
import { ClassesComponent } from './components/classes.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'not-authorized', component: NotAuthorizedComponent },
	{
		path: 'app',
		component: AppShellComponent,
		canActivate: [authGuard],
		children: [
			{ path: 'users', component: UsersManagementComponent, canActivate: [roleGuard(['DIRECTOR'])] },
			{ path: 'products', component: ProductsComponent, canActivate: [roleGuard(['DIRECTOR'])] },
			{ path: 'students', component: StudentsComponent, canActivate: [roleGuard(['DIRECTOR','SALE'])] },
			{ path: 'classes', component: ClassesComponent, canActivate: [roleGuard(['DIRECTOR','SALE'])] },
			{ path: '', pathMatch: 'full', redirectTo: 'users' }
		]
	},
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' }
];
