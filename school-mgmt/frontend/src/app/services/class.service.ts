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
  classMode?: 'ONLINE' | 'OFFLINE';
  teacher?: ClassMember | null;
  sale?: ClassMember | null;
  students?: (ClassMember & { studentCode?: string })[];

  pricePerSession?: number;
  teacherPayPerSession?: number;
  teacherPayPerStudent?: number;
  baseDuration?: number;
  sessionDuration?: number;
  actualPricePerSession?: number;
  actualTeacherPayPerSession?: number;

  revenuePerStudent?: number;
  teacherSalaryCost?: number;

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
  classMode?: 'ONLINE' | 'OFFLINE';
  studentIds: string[];
  pricePerSession?: number;
  teacherPayPerSession?: number;
  teacherPayPerStudent?: number;
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

