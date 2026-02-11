import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

// ─── Interfaces ──────────────────────────────────────────────────

export enum TicketType {
  DISPUTE = 'DISPUTE',
  REFUND_REQUEST = 'REFUND_REQUEST',
  TEACHER_COMPLAINT = 'TEACHER_COMPLAINT',
  PARENT_COMPLAINT = 'PARENT_COMPLAINT',
  SCHEDULE_ISSUE = 'SCHEDULE_ISSUE',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  SUBSTITUTE_TEACHER = 'SUBSTITUTE_TEACHER',
  OTHER = 'OTHER',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_INFO = 'WAITING_INFO',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export const TICKET_TYPE_LABELS: Record<string, string> = {
  [TicketType.DISPUTE]: 'Tranh chấp buổi học',
  [TicketType.REFUND_REQUEST]: 'Yêu cầu hoàn tiền',
  [TicketType.TEACHER_COMPLAINT]: 'Khiếu nại giáo viên',
  [TicketType.PARENT_COMPLAINT]: 'Khiếu nại phụ huynh',
  [TicketType.SCHEDULE_ISSUE]: 'Vấn đề lịch học',
  [TicketType.PAYMENT_ISSUE]: 'Vấn đề thanh toán',
  [TicketType.SUBSTITUTE_TEACHER]: 'GV dạy thay',
  [TicketType.OTHER]: 'Khác',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  [TicketStatus.OPEN]: 'Mới tạo',
  [TicketStatus.IN_PROGRESS]: 'Đang xử lý',
  [TicketStatus.WAITING_INFO]: 'Chờ thông tin',
  [TicketStatus.RESOLVED]: 'Đã giải quyết',
  [TicketStatus.CLOSED]: 'Đã đóng',
  [TicketStatus.CANCELLED]: 'Đã hủy',
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  [TicketPriority.LOW]: 'Thấp',
  [TicketPriority.MEDIUM]: 'Trung bình',
  [TicketPriority.HIGH]: 'Cao',
  [TicketPriority.URGENT]: 'Khẩn cấp',
};

export interface TicketItem {
  _id: string;
  ticketCode: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  createdBy: { _id: string; fullName: string; email: string; role: string };
  createdByRole: string;
  assignedTo?: { _id: string; fullName: string; email: string };
  sessionId?: any;
  classId?: any;
  studentId?: any;
  teacherId?: any;
  parentId?: any;
  resolution?: {
    summary: string;
    outcome: string;
    refundAmount: number;
    resolvedBy?: { _id: string; fullName: string };
    resolvedAt: string;
  };
  attachments: string[];
  dueDate?: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  _id: string;
  ticketId: string;
  userId: { _id: string; fullName: string; email: string; role: string };
  content: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
}

export interface TicketStats {
  byStatus: { _id: string; count: number }[];
  byType: { _id: string; count: number }[];
  byPriority: { _id: string; count: number }[];
  overdueCount: number;
}

export interface TicketListResult {
  data: TicketItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Service ─────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TicketService {
  private base = `${environment.apiBase}/tickets`;
  private http = inject(HttpClient);

  private buildParams(params: Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  // ── List (OPS/DIRECTOR) ──
  async findAll(params: Record<string, string> = {}): Promise<TicketListResult> {
    return firstValueFrom(
      this.http.get<TicketListResult>(this.base, {
        params: this.buildParams(params),
        withCredentials: true,
      }),
    );
  }

  // ── My tickets (PARENT/TEACHER) ──
  async getMyTickets(params: Record<string, string> = {}): Promise<TicketListResult> {
    return firstValueFrom(
      this.http.get<TicketListResult>(`${this.base}/my-tickets`, {
        params: this.buildParams(params),
        withCredentials: true,
      }),
    );
  }

  // ── Assigned to me (OPS) ──
  async getAssignedToMe(params: Record<string, string> = {}): Promise<TicketListResult> {
    return firstValueFrom(
      this.http.get<TicketListResult>(`${this.base}/assigned-to-me`, {
        params: this.buildParams(params),
        withCredentials: true,
      }),
    );
  }

  // ── Detail ──
  async findById(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.get<TicketItem>(`${this.base}/${id}`, { withCredentials: true }),
    );
  }

  // ── Create ──
  async create(data: any): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(this.base, data, { withCredentials: true }),
    );
  }

  // ── Update (priority/assign) ──
  async update(id: string, data: any): Promise<TicketItem> {
    return firstValueFrom(
      this.http.patch<TicketItem>(`${this.base}/${id}`, data, { withCredentials: true }),
    );
  }

  // ── Comments ──
  async getComments(ticketId: string): Promise<TicketComment[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<TicketComment[]>(`${this.base}/${ticketId}/comments`, { withCredentials: true }),
      );
      return res;
    } catch {
      return [];
    }
  }

  async addComment(ticketId: string, data: { content: string; isInternal?: boolean }): Promise<TicketComment> {
    return firstValueFrom(
      this.http.post<TicketComment>(`${this.base}/${ticketId}/comments`, data, {
        withCredentials: true,
      }),
    );
  }

  // ── Workflow actions ──
  async startProcessing(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/start`, {}, { withCredentials: true }),
    );
  }

  async requestInfo(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/request-info`, {}, { withCredentials: true }),
    );
  }

  async resolve(id: string, data: { summary: string; outcome: string; refundAmount?: number }): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/resolve`, data, { withCredentials: true }),
    );
  }

  async close(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/close`, {}, { withCredentials: true }),
    );
  }

  async cancel(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/cancel`, {}, { withCredentials: true }),
    );
  }

  async reopen(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/reopen`, {}, { withCredentials: true }),
    );
  }

  // ── Stats ──
  async getStats(): Promise<TicketStats> {
    return firstValueFrom(
      this.http.get<TicketStats>(`${this.base}/stats`, { withCredentials: true }),
    );
  }
}
