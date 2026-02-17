import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WorkSessionService {
  private apiUrl = `${environment.apiBase}/work-sessions`;

  constructor(private http: HttpClient) {}

  async list(params?: Record<string, string>): Promise<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get(this.apiUrl, { params: httpParams }).toPromise();
  }

  async getMy(params?: Record<string, string>): Promise<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get(`${this.apiUrl}/my`, { params: httpParams }).toPromise();
  }

  async getSummary(periodStart: string, periodEnd: string): Promise<any> {
    const params = new HttpParams()
      .set('periodStart', periodStart)
      .set('periodEnd', periodEnd);
    return this.http.get(`${this.apiUrl}/summary`, { params }).toPromise();
  }

  async update(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Update failed' };
    }
  }
}
