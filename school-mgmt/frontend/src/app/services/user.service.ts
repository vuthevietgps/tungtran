import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface UserItem {
  _id: string;
  userCode?: string;
  email: string;
  fullName: string;
  role: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private auth: AuthService) {}

  private authHeaders(): Record<string, string> {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async list(): Promise<UserItem[]> {
    const res = await fetch(`${environment.apiBase}/users`, {
      headers: { ...this.authHeaders() }
    });
    if (!res.ok) return [];
    return res.json();
  }

  async listTeachers(): Promise<UserItem[]> {
    const res = await fetch(`${environment.apiBase}/users/teachers`, {
      headers: { ...this.authHeaders() }
    });
    if (!res.ok) return [];
    return res.json();
  }

  async listSales(): Promise<UserItem[]> {
    const res = await fetch(`${environment.apiBase}/users/sales`, {
      headers: { ...this.authHeaders() }
    });
    if (!res.ok) return [];
    return res.json();
  }

  async create(payload: { userCode: string; email: string; password: string; fullName: string; role: string }): Promise<boolean> {
    const res = await fetch(`${environment.apiBase}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload)
    });
    return res.ok;
  }

  async update(id: string, payload: Partial<{ userCode: string; email: string; password: string; fullName: string; role: string }>): Promise<boolean> {
    const res = await fetch(`${environment.apiBase}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload)
    });
    return res.ok;
  }

  async remove(id: string): Promise<boolean> {
    const res = await fetch(`${environment.apiBase}/users/${id}`, {
      method: 'DELETE',
      headers: { ...this.authHeaders() }
    });
    return res.ok;
  }
}
