import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
  fullName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'auth_token';
  private readonly router = inject(Router);
  userSignal = signal<AuthPayload | null>(null);

  constructor() {
    const token = this.getToken();
    if (token) {
      const payload = this.decode(token);
      if (payload) this.userSignal.set(payload);
    }
  }

  private decode(token: string): AuthPayload | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { sub: payload.sub, email: payload.email, role: payload.role, fullName: payload.fullName };
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.storageKey);
  }

  isLoggedIn(): boolean {
    return !!this.userSignal();
  }

  async login(email: string, password: string): Promise<boolean> {
    const res = await fetch(`${environment.apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem(this.storageKey, data.access_token);
    this.userSignal.set(data.user);
    return true;
  }

  logout() {
    localStorage.removeItem(this.storageKey);
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  hasRole(roles: string[]): boolean {
    const u = this.userSignal();
    if (!u) return false;
    const role = (u.role || '').trim().toUpperCase();
    return roles.some((r) => role === (r || '').trim().toUpperCase());
  }
}
