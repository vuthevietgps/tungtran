import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/audit-log`;

  getAll(params: {
    page?: number; limit?: number; userId?: string; action?: string;
    module?: string; search?: string; fromDate?: string; toDate?: string;
  } = {}) {
    const q: any = {};
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q[k] = v; });
    return firstValueFrom(this.http.get<any>(this.base, { params: q }));
  }

  getStats() {
    return firstValueFrom(this.http.get<any>(`${this.base}/stats`));
  }
}
