import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface ExpenseItem {
  _id: string;
  expenseCode: string;
  title: string;
  description?: string;
  amount: number;
  expenseDate: string;
  category: string;
  paymentStatus: string;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  paidById?: string;
  paidByName?: string;
  paidAt?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseStats {
  totalCount: number;
  totalAmount: number;
  byStatus: Record<string, { count: number; total: number }>;
  byCategory: Record<string, { count: number; total: number }>;
}

export interface ExpensePaginatedResponse {
  data: ExpenseItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  private apiUrl = `${environment.apiBase}/expenses`;

  constructor(private http: HttpClient) {}

  async list(params?: Record<string, string>): Promise<ExpensePaginatedResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get<ExpensePaginatedResponse>(this.apiUrl, { params: httpParams }).toPromise() as Promise<ExpensePaginatedResponse>;
  }

  async getStats(startDate?: string, endDate?: string): Promise<ExpenseStats> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<ExpenseStats>(`${this.apiUrl}/stats`, { params }).toPromise() as Promise<ExpenseStats>;
  }

  async getOne(id: string): Promise<ExpenseItem> {
    return this.http.get<ExpenseItem>(`${this.apiUrl}/${id}`).toPromise() as Promise<ExpenseItem>;
  }

  async create(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(this.apiUrl, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Create failed' };
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

  async delete(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Delete failed' };
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
      await this.http.post(`${this.apiUrl}/${id}/reject`, { rejectionReason: reason }).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Reject failed' };
    }
  }

  async markPaid(id: string, data: { paymentMethod: string; paidAt?: string; notes?: string }): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/${id}/mark-paid`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Mark paid failed' };
    }
  }
}
