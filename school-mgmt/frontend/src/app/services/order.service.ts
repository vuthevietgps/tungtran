import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface OrderSessionEntry {
  sessionIndex: number;
  date?: string;
  classCode?: string;
  studentCode?: string;
  lookupUrl?: string;
  attendanceId?: string;
  attendedAt?: string;
  imageUrl?: string;
}

export interface OrderItem {
  _id: string;
  studentId?: string;
  studentName: string;
  studentCode: string;
  level?: string;
  parentName: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherCode?: string;
  teacherSalary?: number;
  saleId?: string;
  saleName?: string;
  saleEmail?: string;
  classId?: string;
  classCode?: string;
  invoiceNumber?: string;
  sessionsByInvoice?: number;
  dataStatus?: string;
  trialOrGift?: string;
  createdAt: string;
  updatedAt: string;
  sessions: OrderSessionEntry[];
}

export interface OrderPayload {
  studentId?: string;
  studentName: string;
  studentCode: string;
  level?: string;
  parentName: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherCode?: string;
  teacherSalary?: number;
  saleId?: string;
  saleName?: string;
  saleEmail?: string;
  classId?: string;
  classCode?: string;
  invoiceNumber?: string;
  sessionsByInvoice?: number;
  dataStatus?: string;
  trialOrGift?: string;
}

export interface OrderMutationResult {
  ok: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private auth: AuthService) {}

  private authHeaders(json = false): Record<string, string> {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async list(): Promise<OrderItem[]> {
    const res = await fetch(`${environment.apiBase}/orders`, { headers: this.authHeaders() });
    if (!res.ok) {
      console.error('Failed to load orders', await res.text());
      return [];
    }
    return res.json();
  }

  async create(payload: OrderPayload): Promise<OrderMutationResult> {
    const res = await fetch(`${environment.apiBase}/orders`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  async update(id: string, payload: Partial<OrderPayload>): Promise<OrderMutationResult> {
    const res = await fetch(`${environment.apiBase}/orders/${id}`, {
      method: 'PATCH',
      headers: this.authHeaders(true),
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  async remove(id: string): Promise<OrderMutationResult> {
    const res = await fetch(`${environment.apiBase}/orders/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  private async fail(res: Response, fallback = 'Không thể thực hiện thao tác'): Promise<OrderMutationResult> {
    let message = fallback;
    try {
      const data = await res.json();
      message = data?.message ?? message;
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    return { ok: false, message };
  }
}
