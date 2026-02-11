import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/dashboard`;

  getDirectorDashboard(fromDate?: string, toDate?: string) {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return firstValueFrom(this.http.get<any>(`${this.base}/director`, { params }));
  }

  getDirectorComprehensive(fromDate?: string, toDate?: string) {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return firstValueFrom(this.http.get<any>(`${this.base}/director/comprehensive`, { params }));
  }

  getBirthdays(month?: number) {
    const params: any = {};
    if (month) params.month = month;
    return firstValueFrom(this.http.get<any>(`${this.base}/birthdays`, { params }));
  }

  getAccountingDashboard(fromDate?: string, toDate?: string) {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return firstValueFrom(this.http.get<any>(`${this.base}/accounting`, { params }));
  }

  getOpsDashboard() {
    return firstValueFrom(this.http.get<any>(`${this.base}/ops`));
  }

  getTeacherDashboard() {
    return firstValueFrom(this.http.get<any>(`${this.base}/teacher`));
  }

  getParentDashboard() {
    return firstValueFrom(this.http.get<any>(`${this.base}/parent`));
  }

  getTeacherKPI(fromDate?: string, toDate?: string) {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return firstValueFrom(this.http.get<any>(`${this.base}/director/teacher-kpi`, { params }));
  }

  getCalendarOverview(month?: number, year?: number) {
    const params: any = {};
    if (month) params.month = month;
    if (year) params.year = year;
    return firstValueFrom(this.http.get<any>(`${this.base}/director/calendar`, { params }));
  }
}
