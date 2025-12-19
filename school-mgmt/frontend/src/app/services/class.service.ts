import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ClassMember {
  _id: string;
  fullName: string;
  email?: string;
  salaryLevel?: number;
}

export interface TeacherWithSalaries {
  teacherId: string;
  salary0: number;
  salary1: number;
  salary2: number;
  salary3: number;
  salary4: number;
  salary5: number;
  baseSalary70?: number;
  offlineSalary1?: number;
  offlineSalary2?: number;
  offlineSalary3?: number;
  offlineSalary4?: number;
}

export interface ClassItem {
  _id: string;
  name: string;
  code: string;
  teachers?: {
    teacherId: ClassMember;
    salary0: number;
    salary1: number;
    salary2: number;
    salary3: number;
    salary4: number;
    salary5: number;
    offlineSalary1?: number;
    offlineSalary2?: number;
    offlineSalary3?: number;
    offlineSalary4?: number;
  }[];
  students?: ClassMember[];
  classType?: 'ONLINE' | 'OFFLINE';
  studentCount?: number;
}

export interface ClassPayload {
  name: string;
  code: string;
  teachers: TeacherWithSalaries[];
  studentIds: string[];
  classType: 'ONLINE' | 'OFFLINE';
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
