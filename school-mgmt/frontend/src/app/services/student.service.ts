import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface StudentItem {
  _id: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage: string;
}

export interface StudentMutationResult {
  ok: boolean;
  message?: string;
}

export interface FaceUploadResult extends StudentMutationResult {
  url?: string;
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

  async create(payload: Omit<StudentItem, '_id'>): Promise<StudentMutationResult> {
    const res = await fetch(`${environment.apiBase}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  async update(id: string, payload: Partial<Omit<StudentItem, '_id'>>): Promise<StudentMutationResult> {
    const res = await fetch(`${environment.apiBase}/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  async remove(id: string): Promise<StudentMutationResult> {
    const res = await fetch(`${environment.apiBase}/students/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    if (res.ok) return { ok: true };
    return this.fail(res);
  }

  async uploadFace(file: File): Promise<FaceUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${environment.apiBase}/students/face-upload`, {
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

  private async fail(res: Response, fallback = 'Không thể thực hiện thao tác'): Promise<StudentMutationResult> {
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
