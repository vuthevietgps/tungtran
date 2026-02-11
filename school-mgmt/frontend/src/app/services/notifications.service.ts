import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/notifications`;

  getMyNotifications(params: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
    const q: any = {};
    if (params.page) q.page = params.page;
    if (params.limit) q.limit = params.limit;
    if (params.unreadOnly) q.unreadOnly = 'true';
    return firstValueFrom(this.http.get<any>(this.base, { params: q }));
  }

  getUnreadCount() {
    return firstValueFrom(this.http.get<{ count: number }>(`${this.base}/unread-count`));
  }

  markAsRead(id: string) {
    return firstValueFrom(this.http.patch<any>(`${this.base}/${id}/read`, {}));
  }

  markAllAsRead() {
    return firstValueFrom(this.http.patch<any>(`${this.base}/mark-all-read`, {}));
  }
}
