import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface StudentItem {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage: string;
  productPackage?: {
    _id: string;
    name: string;
    price: number;
  };
}

export interface StudentReportEntry {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage?: string;
  productPackage?: {
    _id: string;
    name: string;
    price: number;
  };
  totalAttendance: number;
}

@Injectable({ providedIn: 'root' })
export class StudentService {
  constructor(private auth: AuthService) {}

  private authHeaders(): Record<string, string> {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async list(): Promise<StudentItem[]> {
    const res = await fetch(`${environment.apiBase}/students`, { headers: this.authHeaders() });
    if (!res.ok) {
      console.error('Failed to load students', await res.text());
      return [];
    }
    return res.json();
  }

  async getStudentReport(classId?: string, searchTerm?: string): Promise<StudentReportEntry[]> {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (searchTerm) params.append('searchTerm', searchTerm);

    const url = `${environment.apiBase}/students/report${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url, { headers: this.authHeaders() });

    if (!res.ok) {
      console.error('Failed to load student report', await res.text());
      return [];
    }
    return res.json();
  }

}
