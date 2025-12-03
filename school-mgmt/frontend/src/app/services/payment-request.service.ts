import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface SessionInfo {
  sessionIndex: number;
  date?: string;
  attendedAt?: string;
  imageUrl?: string;
}

export interface PaymentRequestItem {
  _id: string;
  orderId: string;
  studentCode: string;
  studentName: string;
  classCode: string;
  teacherSalary?: number;
  sessions: SessionInfo[];
  totalAttendedSessions: number;
  teacherEarnedSalary: number;
  paymentStatus?: string;
  paymentInvoiceCode?: string;
  paymentProofImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequestMutationResult {
  ok: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentRequestService {
  constructor(private auth: AuthService) {}

  private authHeaders(json = false): Record<string, string> {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async list(): Promise<PaymentRequestItem[]> {
    const res = await fetch(`${environment.apiBase}/payment-requests`, { headers: this.authHeaders() });
    if (!res.ok) {
      console.error('Failed to load payment requests', await res.text());
      return [];
    }
    return res.json();
  }

  async submitRequest(id: string): Promise<PaymentRequestMutationResult> {
    const res = await fetch(`${environment.apiBase}/payment-requests/${id}/submit`, {
      method: 'PATCH',
      headers: this.authHeaders(true),
      body: JSON.stringify({ paymentStatus: 'Đề nghị thanh toán' }),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  private async fail(res: Response, fallback = 'Không thể thực hiện thao tác'): Promise<PaymentRequestMutationResult> {
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
