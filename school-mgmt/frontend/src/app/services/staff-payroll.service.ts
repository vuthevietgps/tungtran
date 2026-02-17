import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StaffPayrollService {
  private apiUrl = `${environment.apiBase}/staff-payroll`;

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

  async getSummary(): Promise<any> {
    return this.http.get(`${this.apiUrl}/summary`).toPromise();
  }

  async getOne(id: string): Promise<any> {
    return this.http.get(`${this.apiUrl}/${id}`).toPromise();
  }

  async generate(data: any): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      const res = await this.http.post(this.apiUrl, data).toPromise();
      return { ok: true, data: res };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Generate failed' };
    }
  }

  async bulkGenerate(data: { periodStart: string; periodEnd: string }): Promise<{ ok: boolean; data?: any; message?: string }> {
    try {
      const res = await this.http.post(`${this.apiUrl}/bulk-generate`, data).toPromise();
      return { ok: true, data: res };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Bulk generate failed' };
    }
  }

  async update(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Update failed' };
    }
  }

  async submit(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/${id}/submit`, {}).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Submit failed' };
    }
  }

  async approve(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/${id}/approve`, {}).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Approve failed' };
    }
  }

  async reject(id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/${id}/reject`, { reason }).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Reject failed' };
    }
  }

  async reopen(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/${id}/reopen`, {}).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Reopen failed' };
    }
  }

  async markPaid(id: string, paymentRef?: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/${id}/mark-paid`, { paymentRef }).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Mark paid failed' };
    }
  }

  async delete(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Delete failed' };
    }
  }
}
