import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ProductItem {
  _id: string;
  name: string;
  code: string;
}

export interface ProductCreateResult {
  ok: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(private auth: AuthService) {}

  private headers(): HeadersInit {
    const token = this.auth.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async list(): Promise<ProductItem[]> {
    const res = await fetch(`${environment.apiBase}/products`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      console.error('Failed to fetch products', await res.text());
      return [];
    }
    return res.json();
  }

  async create(payload: { name: string; code: string }): Promise<ProductCreateResult> {
    const res = await fetch(`${environment.apiBase}/products`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return { ok: true };
    }
    let message = 'Không thể tạo sản phẩm';
    try {
      const data = await res.json();
      message = data?.message ?? message;
    } catch {
      message = await res.text();
    }
    return { ok: false, message };
  }
}
