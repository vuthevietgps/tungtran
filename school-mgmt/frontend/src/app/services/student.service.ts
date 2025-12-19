import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface StudentItem {
  _id: string;
  studentCode: string;
  fullName: string;
  dateOfBirth?: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage: string;
  level?: string;
  studentType?: 'ONLINE' | 'OFFLINE';
  saleId?: string;
  saleName?: string;
  saleEmail?: string;
  productPackage?: {
    _id: string;
    name: string;
    price: number;
  };
  sessionBalances?: {
    basePaid70: number;
    baseUsed70: number;
    remaining70Exact: number;
    remaining70: number;
    remaining50: number;
    remaining40: number;
    remaining90: number;
    remaining110: number;
    remaining120: number;
    remaining150: number;
  };
  payments?: StudentPaymentFrame[];
}

export interface StudentPaymentFrame {
  frameIndex: number;
  sessionsCollected?: number;
  sessionsRegistered?: number;
  sessionDuration?: number;
  confirmStatus?: 'PENDING' | 'CONFIRMED';
}

export interface StudentReportEntry {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage?: string;
  productPackage?: {
    _id: string;
    name: string;
    price: number;
  };
  totalAttendance: number;
}

@Injectable({ providedIn: 'root' })
export class StudentService {
  constructor(private auth: AuthService) {}

  private authHeaders(): Record<string, string> {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async list(): Promise<StudentItem[]> {
    const res = await fetch(`${environment.apiBase}/students`, { headers: this.authHeaders() });
    if (!res.ok) {
      console.error('Failed to load students', await res.text());
      return [];
    }
    return res.json();
  }

  async create(payload: any): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(`${environment.apiBase}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      return { ok: false, message: await res.text() };
    }
    return { ok: true };
  }

  async update(id: string, payload: any): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(`${environment.apiBase}/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      return { ok: false, message: await res.text() };
    }
    return { ok: true };
  }

  async remove(id: string): Promise<{ ok: boolean; message?: string }> {
    console.log('Sending DELETE request to:', `${environment.apiBase}/students/${id}`);
    const res = await fetch(`${environment.apiBase}/students/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders()
    });
    console.log('DELETE response status:', res.status);
    console.log('DELETE response ok:', res.ok);
    if (!res.ok) {
      const errorText = await res.text();
      console.error('DELETE failed with:', errorText);
      return { ok: false, message: errorText };
    }
    const responseData = await res.json().catch(() => null);
    console.log('DELETE response data:', responseData);
    return { ok: true };
  }

  async uploadFace(file: File): Promise<{ ok: boolean; url?: string; message?: string }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${environment.apiBase}/students/face-upload`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: form
    });
    if (!res.ok) {
      return { ok: false, message: await res.text() };
    }
    const data = await res.json();
    return { ok: true, url: data.url };
  }

  async getStudentReport(classId?: string, searchTerm?: string): Promise<StudentReportEntry[]> {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (searchTerm) params.append('searchTerm', searchTerm);

    const url = `${environment.apiBase}/students/report${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url, { headers: this.authHeaders() });

    if (!res.ok) {
      console.error('Failed to load student report', await res.text());
      return [];
    }
    return res.json();
  }

  async approve(studentId: string, action: 'APPROVE' | 'REJECT', userId: string): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(`${environment.apiBase}/students/${studentId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ action, userId })
    });
    if (!res.ok) {
      return { ok: false, message: await res.text() };
    }
    return { ok: true };
  }

  async getPendingApproval(): Promise<StudentItem[]> {
    const res = await fetch(`${environment.apiBase}/students/pending`, { headers: this.authHeaders() });
    if (!res.ok) {
      console.error('Failed to load pending students', await res.text());
      return [];
    }
    return res.json();
  }

  async clearAllData(): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(`${environment.apiBase}/students/clear-all`, {
      method: 'DELETE',
      headers: this.authHeaders()
    });
    if (!res.ok) {
      return { ok: false, message: await res.text() };
    }
    return { ok: true };
  }

}
