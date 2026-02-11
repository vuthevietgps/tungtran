import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Qualification {
  title: string;
  institution?: string;
  year?: number;
  imageUrl?: string;
}

export interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

export interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  branch?: string;
}

export interface TeacherProfile {
  _id: string;
  userId: { _id: string; fullName: string; email: string; phone?: string } | string;
  subjects: string[];
  grades: string[];
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string[];
  bio?: string;
  qualifications: Qualification[];
  yearsOfExperience: number;
  videoIntroUrl?: string;
  availability: AvailabilitySlot[];
  pricePerSession: number;
  pricePerHour?: number;
  status: string;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  activeClasses: number;
  bankInfo?: BankInfo;
  approvedBy?: { _id: string; fullName: string };
  approvedAt?: string;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherFullProfile {
  profile: TeacherProfile;
  classes: {
    active: any[];
    completed: any[];
    totalActive: number;
    totalCompleted: number;
  };
  sessions: {
    byStatus: Record<string, { count: number; totalPayout: number }>;
    totalCount: number;
    totalEarnings: number;
    recent: any[];
  };
  payroll: {
    byStatus: Record<string, { count: number; totalAmount: number }>;
    totalPaid: number;
  };
}

export interface TeachingMaterial {
  _id: string;
  teacherId: string;
  title: string;
  description?: string;
  subject?: string;
  grade?: string;
  classId?: { _id: string; name: string } | string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  originalName: string;
  tags: string[];
  isShared: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class TeacherService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/teachers`;

  /** Lấy danh sách tất cả giáo viên */
  async getAllTeachers(params?: { status?: string; subjects?: string; grades?: string }): Promise<TeacherProfile[]> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.subjects) httpParams = httpParams.set('subjects', params.subjects);
    if (params?.grades) httpParams = httpParams.set('grades', params.grades);
    return firstValueFrom(
      this.http.get<TeacherProfile[]>(this.base, {
        withCredentials: true,
        params: httpParams,
      }),
    );
  }

  /** Lấy hồ sơ giáo viên của chính mình */
  async getMyProfile(): Promise<TeacherProfile> {
    return firstValueFrom(
      this.http.get<TeacherProfile>(`${this.base}/me`, { withCredentials: true }),
    );
  }

  /** Lấy profile đầy đủ với thống kê */
  async getFullProfile(id: string): Promise<TeacherFullProfile> {
    return firstValueFrom(
      this.http.get<TeacherFullProfile>(`${this.base}/${id}/profile`, { withCredentials: true }),
    );
  }

  /** Cập nhật hồ sơ giáo viên */
  async updateProfile(id: string, payload: Partial<TeacherProfile>): Promise<TeacherProfile> {
    return firstValueFrom(
      this.http.patch<TeacherProfile>(`${this.base}/${id}`, payload, { withCredentials: true }),
    );
  }

  // ── Teaching Materials ──────────────────────────────────────

  /** Lấy danh sách tài liệu */
  async getMaterials(params?: { subject?: string; grade?: string; classId?: string }): Promise<TeachingMaterial[]> {
    let httpParams = new HttpParams();
    if (params?.subject) httpParams = httpParams.set('subject', params.subject);
    if (params?.grade) httpParams = httpParams.set('grade', params.grade);
    if (params?.classId) httpParams = httpParams.set('classId', params.classId);
    return firstValueFrom(
      this.http.get<TeachingMaterial[]>(`${environment.apiBase}/teaching-materials`, {
        withCredentials: true,
        params: httpParams,
      }),
    );
  }

  /** Upload tài liệu mới */
  async uploadMaterial(file: File, metadata: {
    title: string;
    description?: string;
    subject?: string;
    grade?: string;
    classId?: string;
    tags?: string[];
    isShared?: boolean;
  }): Promise<TeachingMaterial> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.subject) formData.append('subject', metadata.subject);
    if (metadata.grade) formData.append('grade', metadata.grade);
    if (metadata.classId) formData.append('classId', metadata.classId);
    if (metadata.tags?.length) formData.append('tags', JSON.stringify(metadata.tags));
    if (metadata.isShared !== undefined) formData.append('isShared', String(metadata.isShared));

    return firstValueFrom(
      this.http.post<TeachingMaterial>(`${environment.apiBase}/teaching-materials/upload`, formData, {
        withCredentials: true,
      }),
    );
  }

  /** Cập nhật thông tin tài liệu */
  async updateMaterial(id: string, payload: Partial<{
    title: string;
    description: string;
    subject: string;
    grade: string;
    classId: string;
    tags: string[];
    isShared: boolean;
  }>): Promise<TeachingMaterial> {
    return firstValueFrom(
      this.http.patch<TeachingMaterial>(`${environment.apiBase}/teaching-materials/${id}`, payload, {
        withCredentials: true,
      }),
    );
  }

  /** Xóa tài liệu */
  async deleteMaterial(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBase}/teaching-materials/${id}`, { withCredentials: true }),
    );
  }
}
