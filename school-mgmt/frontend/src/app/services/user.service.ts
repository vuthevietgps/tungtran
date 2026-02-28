import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserItem {
  _id: string;
  userCode?: string;
  email: string;
  fullName: string;
  role: string;
  status?: string;
  phone?: string;
  facebookLink?: string;
  address?: string;
}

export interface CreateUserPayload {
  userCode: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
  facebookLink?: string;
  address?: string;
}

export type UpdateUserPayload = Partial<CreateUserPayload>;

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  async list(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async listTeachers(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users/teachers`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async listSales(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users/sales`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async listParents(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users/parents`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async create(payload: CreateUserPayload): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/users`, payload, { withCredentials: true }),
    );
    return true;
  }

  async update(id: string, payload: UpdateUserPayload): Promise<boolean> {
    await firstValueFrom(
      this.http.patch(`${environment.apiBase}/users/${id}`, payload, { withCredentials: true }),
    );
    return true;
  }

  async remove(id: string): Promise<boolean> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBase}/users/${id}`, { withCredentials: true }),
    );
    return true;
  }
}
