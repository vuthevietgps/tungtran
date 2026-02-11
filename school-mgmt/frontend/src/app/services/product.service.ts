import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProductItem {
  _id: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  teachingMode?: string;
  defaultSessions?: number;
  defaultSessionDuration?: number;
  pricePerSession?: number;
  suggestedPrice?: number;
  commissionRate?: number;
  gradeLevel?: string;
  highlights?: string[];
  isActive?: boolean;
}

export interface ProductCreateResult {
  ok: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);

  async list(): Promise<ProductItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<ProductItem[]>(`${environment.apiBase}/products`, {
          withCredentials: true,
        }),
      );
    } catch {
      return [];
    }
  }

  async create(payload: Partial<ProductItem>): Promise<ProductCreateResult> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/products`, payload, {
          withCredentials: true,
        }),
      );
      return { ok: true };
    } catch (error: any) {
      const message = error?.error?.message || 'Không thể tạo sản phẩm';
      return { ok: false, message };
    }
  }

  async update(id: string, payload: Partial<ProductItem>): Promise<ProductCreateResult> {
    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiBase}/products/${id}`, payload, {
          withCredentials: true,
        }),
      );
      return { ok: true };
    } catch (error: any) {
      const message = error?.error?.message || 'Không thể cập nhật sản phẩm';
      return { ok: false, message };
    }
  }

  async remove(id: string): Promise<ProductCreateResult> {
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiBase}/products/${id}`, {
          withCredentials: true,
        }),
      );
      return { ok: true };
    } catch (error: any) {
      const message = error?.error?.message || 'Không thể xóa sản phẩm';
      return { ok: false, message };
    }
  }
}
