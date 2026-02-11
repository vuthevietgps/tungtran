import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
  fullName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  userSignal = signal<AuthPayload | null>(null);
  private _restored = false;

  isLoggedIn(): boolean {
    return !!this.userSignal();
  }

  /** Restore session from httpOnly cookie on page load */
  async restoreSession(): Promise<boolean> {
    if (this._restored) return this.isLoggedIn();
    this._restored = true;
    try {
      const data = await firstValueFrom(
        this.http.get<AuthPayload & { _id: string }>(`${environment.apiBase}/users/me`, {
          withCredentials: true,
        }),
      );
      if (data?.email) {
        this.userSignal.set({
          sub: data._id,
          email: data.email,
          role: data.role,
          fullName: data.fullName,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      const data = await firstValueFrom(
        this.http.post<{ user: AuthPayload }>(
          `${environment.apiBase}/auth/login`,
          { email, password },
          { withCredentials: true },
        ),
      );
      this.userSignal.set(data.user);
      return true;
    } catch {
      return false;
    }
  }

  async logout() {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/auth/logout`, {}, { withCredentials: true }),
      );
    } catch {
      // ignore
    }
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  hasRole(roles: string[]): boolean {
    const u = this.userSignal();
    return !!u && roles.includes(u.role);
  }
}
