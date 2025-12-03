import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ClassroomStatusItem {
  _id: string;
  orderId: string;
  studentCode: string;
  studentName: string;
  classCode: string;
  status: string;
  paymentStatus?: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LockPayload {
  isLocked: boolean;
}

export interface ClassroomStatusMutationResult {
  ok: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ClassroomStatusService {
  constructor(private auth: AuthService) {}

  private authHeaders(json = false): Record<string, string> {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async list(): Promise<ClassroomStatusItem[]> {
    const res = await fetch(`${environment.apiBase}/classroom-status`, { headers: this.authHeaders() });
    if (!res.ok) {
      console.error('Failed to load classroom status', await res.text());
      return [];
    }
    return res.json();
  }

  async lock(id: string, isLocked: boolean): Promise<ClassroomStatusMutationResult> {
    const res = await fetch(`${environment.apiBase}/classroom-status/${id}/lock`, {
      method: 'PATCH',
      headers: this.authHeaders(true),
      body: JSON.stringify({ isLocked }),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  private async fail(res: Response, fallback = 'Không thể thực hiện thao tác'): Promise<ClassroomStatusMutationResult> {
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
