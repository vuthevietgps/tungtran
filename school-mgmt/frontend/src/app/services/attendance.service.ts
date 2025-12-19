import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',                        // Có mặt
  ABSENT_WITH_PERMISSION = 'ABSENT_WITH_PERMISSION',     // Vắng mặt xin phép
  LATE = 'LATE',                              // Đi muộn
  ABSENT_WITHOUT_PERMISSION = 'ABSENT_WITHOUT_PERMISSION', // Vắng mặt không phép
}

export interface StudentAttendanceItem {
  student: {
    _id: string;
    fullName: string;
    age: number;
    parentName: string;
  };
  attendance: {
    _id?: string;
    classId: string;
    studentId: string;
    date: string;
    status: AttendanceStatus | null;
    notes: string;
    absenceProofImage?: string;
    sessionDuration?: number;
    salaryAmount?: number;
  };
}

export interface AttendanceByClassResponse {
  class: {
    _id: string;
    name: string;
    code: string;
    classType?: 'ONLINE' | 'OFFLINE';
  };
  date: string;
  attendanceList: StudentAttendanceItem[];
}

export interface TeacherClassAssignment {
  classId: string;
  classCode: string;
  className: string;
  students: Array<{
    studentId: string;
    fullName: string;
    studentCode: string;
    age?: number;
    parentName?: string;
  }>;
}

export interface OrderClassStudentSummary {
  studentId: string;
  fullName: string;
  studentCode: string;
  age?: number;
  parentName?: string;
}

export interface OrderClassSummary {
  classId: string;
  classCode: string;
  className: string;
  studentCount: number;
  students: OrderClassStudentSummary[];
}

export interface BulkAttendancePayload {
  classId: string;
  teacherId?: string;
  date: string;
  attendances: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
    absenceProofImage?: string;
    sessionDuration?: number;
  }>;
}

export interface AttendanceStatsResponse {
  classId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  statistics: Array<{
    _id: AttendanceStatus;
    count: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private auth: AuthService) {}

  private headers(json = false): HeadersInit {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  // Lấy danh sách điểm danh theo lớp và ngày
  async getAttendanceByClass(classId: string, date: string): Promise<AttendanceByClassResponse | null> {
    try {
      const res = await fetch(`${environment.apiBase}/attendance/class/${classId}?date=${date}`, {
        headers: this.headers()
      });
      
      if (!res.ok) {
        console.error('Failed to load attendance', await res.text());
        return null;
      }
      
      return res.json();
    } catch (error) {
      console.error('Error loading attendance:', error);
      return null;
    }
  }

  // Điểm danh nhiều học sinh cùng lúc
  async bulkMarkAttendance(payload: BulkAttendancePayload): Promise<boolean> {
    try {
      const res = await fetch(`${environment.apiBase}/attendance/bulk-mark`, {
        method: 'POST',
        headers: this.headers(true),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error('Failed to mark attendance', await res.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error marking attendance:', error);
      return false;
    }
  }

  // Điểm danh một học sinh
  async markSingleAttendance(classId: string, studentId: string, date: string, status: AttendanceStatus, notes?: string, sessionDuration?: number): Promise<boolean> {
    try {
      const res = await fetch(`${environment.apiBase}/attendance/mark`, {
        method: 'POST',
        headers: this.headers(true),
        body: JSON.stringify({
          classId,
          studentId,
          date,
          status,
          notes: notes || '',
          sessionDuration
        }),
      });

      if (!res.ok) {
        console.error('Failed to mark single attendance', await res.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error marking single attendance:', error);
      return false;
    }
  }

  async getTeacherClasses(): Promise<TeacherClassAssignment[]> {
    try {
      const res = await fetch(`${environment.apiBase}/attendance/teacher/classes`, {
        headers: this.headers()
      });

      if (!res.ok) {
        console.error('Failed to load teacher classes', await res.text());
        return [];
      }

      return res.json();
    } catch (error) {
      console.error('Error loading teacher classes:', error);
      return [];
    }
  }

  async getOrderClasses(): Promise<OrderClassSummary[]> {
    try {
      const res = await fetch(`${environment.apiBase}/attendance/order-classes`, {
        headers: this.headers()
      });

      if (!res.ok) {
        console.error('Failed to load order-based classes', await res.text());
        return [];
      }

      return res.json();
    } catch (error) {
      console.error('Error loading order-based classes:', error);
      return [];
    }
  }

  // Cập nhật trạng thái điểm danh
  async updateAttendance(attendanceId: string, status: AttendanceStatus, notes?: string): Promise<boolean> {
    try {
      const res = await fetch(`${environment.apiBase}/attendance/${attendanceId}`, {
        method: 'PATCH',
        headers: this.headers(true),
        body: JSON.stringify({
          status,
          notes: notes || ''
        }),
      });

      if (!res.ok) {
        console.error('Failed to update attendance', await res.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating attendance:', error);
      return false;
    }
  }

  // Lấy lịch sử điểm danh của học sinh
  async getStudentAttendanceHistory(studentId: string, classId?: string): Promise<any[]> {
    try {
      const queryParams = classId ? `?classId=${classId}` : '';
      const res = await fetch(`${environment.apiBase}/attendance/student/${studentId}${queryParams}`, {
        headers: this.headers()
      });
      
      if (!res.ok) {
        console.error('Failed to load student attendance history', await res.text());
        return [];
      }
      
      return res.json();
    } catch (error) {
      console.error('Error loading student attendance history:', error);
      return [];
    }
  }

  // Lấy thống kê điểm danh
  async getAttendanceStats(classId: string, startDate: string, endDate: string): Promise<AttendanceStatsResponse | null> {
    try {
      const res = await fetch(`${environment.apiBase}/attendance/stats/${classId}?startDate=${startDate}&endDate=${endDate}`, {
        headers: this.headers()
      });
      
      if (!res.ok) {
        console.error('Failed to load attendance stats', await res.text());
        return null;
      }
      
      return res.json();
    } catch (error) {
      console.error('Error loading attendance stats:', error);
      return null;
    }
  }

  // Helper method để format ngày cho API
  formatDateForAPI(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Helper method để get status display text
  getStatusDisplayText(status: AttendanceStatus | null): string {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'Có mặt';
      case AttendanceStatus.ABSENT_WITHOUT_PERMISSION:
        return 'Vắng mặt không phép';
      case AttendanceStatus.LATE:
        return 'Đi muộn';
      case AttendanceStatus.ABSENT_WITH_PERMISSION:
        return 'Vắng mặt xin phép';
      default:
        return 'Chưa điểm danh';
    }
  }

  // Helper method để get status CSS class
  getStatusClass(status: AttendanceStatus | null): string {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'status-present';
      case AttendanceStatus.ABSENT_WITHOUT_PERMISSION:
        return 'status-absent-without-permission';
      case AttendanceStatus.LATE:
        return 'status-late';
      case AttendanceStatus.ABSENT_WITH_PERMISSION:
        return 'status-absent-with-permission';
      default:
        return 'status-not-marked';
    }
  }

  // Lấy danh sách giáo viên của lớp
  async getClassTeachers(classId: string): Promise<any[]> {
    try {
      const res = await fetch(`${environment.apiBase}/attendance/class/${classId}/teachers`, {
        headers: this.headers()
      });
      
      if (!res.ok) {
        console.error('Failed to load class teachers', await res.text());
        return [];
      }
      
      return res.json();
    } catch (error) {
      console.error('Error loading class teachers:', error);
      return [];
    }
  }

  // Tạo link điểm danh cho học sinh
  async generateAttendanceLink(classId: string, studentId: string, date: string) {
    const token = this.auth.getToken();
    const response = await fetch(`${environment.apiBase}/attendance/generate-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ classId, studentId, date })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Không thể tạo link điểm danh');
    }

    return await response.json();
  }

  // Lấy báo cáo điểm danh tổng hợp
  async getAttendanceReport(startDate: string, endDate: string, classId?: string) {
    const token = this.auth.getToken();
    let url = `${environment.apiBase}/attendance/report?startDate=${startDate}&endDate=${endDate}`;

    const validObjectId = classId && /^[a-fA-F0-9]{24}$/.test(classId);
    if (validObjectId) {
      url += `&classId=${classId}`;
    } else if (classId) {
      console.warn('attendance-report: bỏ qua classId không hợp lệ', classId);
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({} as any));
      throw new Error(error.message || 'Không thể tải báo cáo');
    }

    return await response.json();
  }
}