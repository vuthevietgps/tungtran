import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface InvoiceItem {
  _id: string;
  invoiceNumber: string;
  studentId: {
    _id: string;
    fullName: string;
    parentName: string;
    parentPhone: string;
  };
  amount: number;
  paymentDate: string;
  receiptImage: string;
  description?: string;
  status: string;
  createdBy: {
    _id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceMutationResult {
  ok: boolean;
  message?: string;
}

export interface ReceiptUploadResult extends InvoiceMutationResult {
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  constructor(private auth: AuthService) {}

  private authHeaders(): Record<string, string> {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async list(): Promise<InvoiceItem[]> {
    const res = await fetch(`${environment.apiBase}/invoices`, { headers: this.authHeaders() });
    if (!res.ok) {
      console.error('Failed to load invoices', await res.text());
      return [];
    }
    return res.json();
  }

  async create(payload: Omit<InvoiceItem, '_id' | 'createdBy' | 'createdAt' | 'updatedAt'>): Promise<InvoiceMutationResult> {
    const res = await fetch(`${environment.apiBase}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  async update(id: string, payload: Partial<Omit<InvoiceItem, '_id' | 'createdBy' | 'createdAt' | 'updatedAt'>>): Promise<InvoiceMutationResult> {
    const res = await fetch(`${environment.apiBase}/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  async remove(id: string): Promise<InvoiceMutationResult> {
    const res = await fetch(`${environment.apiBase}/invoices/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  async uploadReceipt(file: File): Promise<ReceiptUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${environment.apiBase}/invoices/receipt-upload`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, url: data?.url };
    }
    return this.fail(res, 'Không thể tải ảnh lên');
  }

  async getInvoicesByStudent(studentId: string): Promise<InvoiceItem[]> {
    const res = await fetch(`${environment.apiBase}/invoices/student/${studentId}`, { headers: this.authHeaders() });
    if (!res.ok) {
      console.error('Failed to load student invoices', await res.text());
      return [];
    }
    return res.json();
  }

  private async fail(res: Response, fallback = 'Không thể thực hiện thao tác'): Promise<InvoiceMutationResult> {
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