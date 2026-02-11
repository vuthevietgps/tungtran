import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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
  students?: (ClassMember & { studentCode?: string })[];
  // Per-session pricing (new model)
  pricePerSession?: number;        // Giá thu HS mỗi buổi (VNĐ) — cho baseDuration
  teacherPayPerSession?: number;   // Lương GV mỗi buổi (VNĐ) — cho baseDuration
  baseDuration?: number;           // Thời lượng cơ sở tính giá (phút), mặc định 60
  sessionDuration?: number;        // Thời lượng thực tế mỗi buổi (phút)
  actualPricePerSession?: number;  // Giá thu thực tế sau tỷ lệ
  actualTeacherPayPerSession?: number; // Lương GV thực tế sau tỷ lệ
  // Legacy fields
  revenuePerStudent?: number;
  teacherSalaryCost?: number;
  // Computed
  totalRevenue?: number;
  totalCost?: number;
  profit?: number;
  studentCount?: number;
  status?: string;
  schedule?: any[];
  totalSessions?: number;
  sessionsCompleted?: number;
}

export interface ClassPayload {
  name: string;
  code: string;
  teacherId: string;
  saleId?: string;
  studentIds: string[];
  pricePerSession?: number;
  teacherPayPerSession?: number;
  baseDuration?: number;
  sessionDuration?: number;
  revenuePerStudent?: number;
  teacherSalaryCost?: number;
}

@Injectable({ providedIn: 'root' })
export class ClassService {
  private http = inject(HttpClient);

  async list(): Promise<ClassItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<ClassItem[]>(`${environment.apiBase}/classes`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async create(payload: ClassPayload): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/classes`, payload, { withCredentials: true }),
    );
    return true;
  }

  async update(id: string, payload: Partial<ClassPayload>): Promise<boolean> {
    await firstValueFrom(
      this.http.patch(`${environment.apiBase}/classes/${id}`, payload, { withCredentials: true }),
    );
    return true;
  }

  async remove(id: string): Promise<boolean> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBase}/classes/${id}`, { withCredentials: true }),
    );
    return true;
  }

  async assignStudents(id: string, studentIds: string[]): Promise<boolean> {
    await firstValueFrom(
      this.http.post(
        `${environment.apiBase}/classes/${id}/assign-students`,
        { studentIds },
        { withCredentials: true },
      ),
    );
    return true;
  }
}
