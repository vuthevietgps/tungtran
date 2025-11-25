import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ClassMember {
  _id: string;
  fullName: string;
  email?: string;
}

export interface ClassItem {
  _id: string;
  name: string;
  code: string;
  teacher?: ClassMember | null;
  sale?: ClassMember | null;
  students?: ClassMember[];
  revenuePerStudent?: number; // Doanh thu mỗi học sinh (VNĐ)
  teacherSalaryCost?: number; // Chi phí lương giáo viên mỗi học sinh (VNĐ)
  totalRevenue?: number; // Tổng doanh thu = revenuePerStudent * số học sinh
  totalCost?: number; // Tổng chi phí = teacherSalaryCost * số học sinh
  profit?: number; // Lợi nhuận = totalRevenue - totalCost
  studentCount?: number; // Tổng số học sinh
}

export interface ClassPayload {
  name: string;
  code: string;
  teacherId: string;
  saleId: string;
  studentIds: string[];
  revenuePerStudent?: number; // Doanh thu mỗi học sinh (VNĐ)
  teacherSalaryCost?: number; // Chi phí lương giáo viên mỗi học sinh (VNĐ)
}

@Injectable({ providedIn: 'root' })
export class ClassService {
  constructor(private auth: AuthService) {}

  private headers(json = false): HeadersInit {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async list(): Promise<ClassItem[]> {
    const res = await fetch(`${environment.apiBase}/classes`, { headers: this.headers() });
    if (!res.ok) {
      console.error('Failed to load classes', await res.text());
      return [];
    }
    return res.json();
  }

  async create(payload: ClassPayload): Promise<boolean> {
    const res = await fetch(`${environment.apiBase}/classes`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify(payload),
    });
    return res.ok;
  }

  async update(id: string, payload: Partial<ClassPayload>): Promise<boolean> {
    const res = await fetch(`${environment.apiBase}/classes/${id}`, {
      method: 'PATCH',
      headers: this.headers(true),
      body: JSON.stringify(payload),
    });
    return res.ok;
  }

  async remove(id: string): Promise<boolean> {
    const res = await fetch(`${environment.apiBase}/classes/${id}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    return res.ok;
  }

  async assignStudents(id: string, studentIds: string[]): Promise<boolean> {
    const res = await fetch(`${environment.apiBase}/classes/${id}/assign-students`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ studentIds }),
    });
    return res.ok;
  }
}
