import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type InvoiceStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PAID'
  | 'PENDING';

export interface InvoiceItem {
  _id: string;
  invoiceNumber: string;
  studentId: {
    _id: string;
    fullName: string;
    parentName: string;
    parentPhone: string;
    studentCode?: string;
  };
  classType?: 'ONLINE' | 'OFFLINE';
  saleId?: {
    _id: string;
    fullName: string;
    email: string;
  };
  sessions?: number;
  amount: number;
  paymentDate: string;
  receiptImage?: string;
  approvalImage?: string;
  description?: string;
  status: InvoiceStatus;
  createdBy: {
    _id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceUpsertPayload {
  invoiceNumber: string;
  studentId: string;
  classType?: 'ONLINE' | 'OFFLINE';
  saleId?: string;
  sessions?: number;
  amount: number;
  paymentDate: string;
  receiptImage?: string;
  description?: string;
  invoiceType?: 'TUITION' | 'MATERIAL' | 'OTHER';
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
  private http = inject(HttpClient);

  async list(): Promise<InvoiceItem[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<InvoiceItem[]>(`${environment.apiBase}/invoices`, { withCredentials: true }),
      );
      return res;
    } catch (error) {
      console.error('Failed to load invoices', error);
      return [];
    }
  }

  async create(payload: InvoiceUpsertPayload): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/invoices`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async update(id: string, payload: Partial<InvoiceUpsertPayload>): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiBase}/invoices/${id}`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async approve(
    id: string,
    action: 'APPROVE' | 'REJECT',
    rejectedReason?: string,
    approvalImage?: string,
  ): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/invoices/${id}/approve`,
          { action, rejectedReason, approvalImage },
          { withCredentials: true },
        ),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async remove(id: string): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiBase}/invoices/${id}`, { withCredentials: true }),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async uploadReceipt(file: File): Promise<ReceiptUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await firstValueFrom(
        this.http.post<{ url?: string }>(`${environment.apiBase}/invoices/receipt-upload`, formData, {
          withCredentials: true,
        }),
      );
      return { ok: true, url: res?.url };
    } catch (error: any) {
      return this.fail(error, 'Khong the tai anh len');
    }
  }

  async getInvoicesByStudent(studentId: string): Promise<InvoiceItem[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<InvoiceItem[]>(`${environment.apiBase}/invoices/student/${studentId}`, {
          withCredentials: true,
        }),
      );
      return res;
    } catch (error) {
      console.error('Failed to load student invoices', error);
      return [];
    }
  }

  private fail(error: any, fallback = 'Khong the thuc hien thao tac'): InvoiceMutationResult {
    const rawMessage = error?.error?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage || fallback;
    return { ok: false, message };
  }
}
