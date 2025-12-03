import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassroomStatusItem, ClassroomStatusService } from '../services/classroom-status.service';

@Component({
  selector: 'app-classroom-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="classroom-status-screen">
      <header class="control-bar">
        <h2 class="page-title">Trạng thái lớp học</h2>
        <div class="control-actions">
          <button type="button" class="ghost" (click)="reload()">Làm mới</button>
        </div>
        <div class="control-stats">
          <span class="badge badge-total">Tổng: {{ statuses().length }}</span>
          <span class="badge badge-locked">Đã khóa: {{ lockedCount() }}</span>
          <span class="badge badge-active">Hoạt động: {{ activeCount() }}</span>
        </div>
      </header>

      <section class="table-area">
        <ng-container *ngIf="statuses().length; else empty">
          <div class="table-scroll">
            <table class="status-table">
              <thead>
                <tr>
                  <th>Mã học sinh</th>
                  <th>Tên học sinh</th>
                  <th>Mã lớp</th>
                  <th>Trạng thái</th>
                  <th>Trạng thái thanh toán</th>
                  <th>Khóa</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let status of statuses()">
                  <td class="cell code">{{ status.studentCode }}</td>
                  <td class="cell student-name">{{ status.studentName }}</td>
                  <td class="cell class-code">{{ status.classCode }}</td>
                  <td class="cell status" [class.active]="status.status === 'Đang hoạt động'" [class.locked]="status.status === 'Đã khóa'">
                    {{ status.status }}
                  </td>
                  <td class="cell payment-status">{{ status.paymentStatus || '-' }}</td>
                  <td class="cell lock-status" [class.locked]="status.isLocked">
                    <span class="lock-badge" [class.locked]="status.isLocked">
                      {{ status.isLocked ? 'Đã khóa' : 'Mở' }}
                    </span>
                  </td>
                  <td class="cell actions">
                    <button 
                      *ngIf="!status.isLocked" 
                      class="danger" 
                      (click)="lockStatus(status)"
                      [disabled]="loading()">
                      Khóa
                    </button>
                    <button 
                      *ngIf="status.isLocked" 
                      class="primary" 
                      (click)="unlockStatus(status)"
                      [disabled]="loading()">
                      Mở khóa
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>
      </section>
    </div>

    <ng-template #empty>
      <div class="empty-state">
        <p>Chưa có dữ liệu trạng thái lớp học.</p>
        <p class="hint">Dữ liệu sẽ tự động được tạo từ đơn hàng.</p>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display:block; color:#e2e8f0; }
    .classroom-status-screen { display:flex; flex-direction:column; gap:18px; }
    .control-bar { display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,#061432,#0b1f47); padding:18px 24px; border-radius:16px; box-shadow:0 18px 45px rgba(4,12,30,0.55); }
    .page-title { margin:0; font-size:20px; font-weight:700; color:#f8fafc; }
    .control-actions { display:flex; gap:12px; align-items:center; }
    .control-stats { display:flex; gap:10px; align-items:center; }
    .badge { padding:6px 12px; border-radius:999px; font-size:13px; font-weight:600; letter-spacing:0.02em; }
    .badge-total { background:rgba(37,99,235,0.18); color:#93c5fd; }
    .badge-locked { background:rgba(239,68,68,0.2); color:#fca5a5; }
    .badge-active { background:rgba(16,185,129,0.2); color:#6ee7b7; }
    .ghost { border:1px solid rgba(148,163,184,0.45); background:rgba(8,17,33,0.6); color:#e2e8f0; padding:8px 16px; border-radius:10px; cursor:pointer; transition:background 0.15s ease, border-color 0.15s ease; }
    .ghost:hover { background:rgba(37,99,235,0.15); border-color:rgba(96,165,250,0.6); }
    .primary { background:linear-gradient(135deg,#2563eb,#4f46e5); color:#fff; border:none; padding:9px 18px; border-radius:12px; cursor:pointer; font-weight:600; letter-spacing:0.01em; box-shadow:0 10px 22px rgba(37,99,235,0.35); transition:transform 0.15s ease, box-shadow 0.15s ease; }
    .primary:disabled { opacity:0.55; cursor:not-allowed; box-shadow:none; }
    .primary:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 16px 28px rgba(37,99,235,0.45); }
    .danger { background:linear-gradient(135deg,#dc2626,#ef4444); color:#fff; border:none; padding:9px 18px; border-radius:12px; cursor:pointer; font-weight:600; letter-spacing:0.01em; box-shadow:0 10px 22px rgba(220,38,38,0.35); transition:transform 0.15s ease, box-shadow 0.15s ease; }
    .danger:disabled { opacity:0.55; cursor:not-allowed; box-shadow:none; }
    .danger:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 16px 28px rgba(220,38,38,0.45); }
    .table-area { background:linear-gradient(135deg,#051028,#0c1c3d); border-radius:16px; box-shadow:0 18px 40px rgba(4,15,35,0.6); padding:0; }
    .table-scroll { width:100%; overflow:auto; border-radius:16px; }
    .status-table { width:100%; border-collapse:separate; border-spacing:0; min-width:900px; color:#e2e8f0; }
    .status-table thead th { position:sticky; top:0; background:linear-gradient(135deg,#4338ca,#2563eb); color:#f8fafc; padding:14px 16px; text-transform:uppercase; font-size:12px; letter-spacing:0.08em; border-bottom:1px solid rgba(148,163,184,0.35); z-index:2; }
    .status-table tbody td { padding:14px 16px; border-bottom:1px solid rgba(148,163,184,0.18); background:rgba(9,18,38,0.92); font-size:14px; }
    .status-table tbody tr:nth-child(odd) td { background:rgba(12,24,46,0.9); }
    .status-table tbody tr:hover td { background:rgba(30,58,108,0.85); }
    .cell { min-width:120px; border-right:1px solid rgba(148,163,184,0.12); }
    .cell.code { font-weight:600; color:#93c5fd; }
    .cell.student-name { min-width:180px; font-weight:600; }
    .cell.class-code { font-weight:600; color:#a5b4fc; }
    .cell.status { text-align:center; font-weight:600; }
    .cell.status.active { color:#6ee7b7; }
    .cell.status.locked { color:#fca5a5; }
    .cell.payment-status { min-width:150px; }
    .cell.lock-status { text-align:center; }
    .lock-badge { display:inline-block; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:600; background:rgba(16,185,129,0.2); color:#6ee7b7; }
    .lock-badge.locked { background:rgba(239,68,68,0.2); color:#fca5a5; }
    .cell.actions { display:flex; gap:8px; justify-content:center; background:rgba(12,30,58,0.95); }
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:48px; border-radius:16px; background:linear-gradient(135deg,#061432,#0c1f42); box-shadow:0 18px 38px rgba(4,15,37,0.55); }
    .empty-state p { margin:0; font-size:15px; }
    .empty-state .hint { font-size:13px; color:#94a3b8; }
  `],
})
export class ClassroomStatusComponent {
  statuses = signal<ClassroomStatusItem[]>([]);
  loading = signal(false);

  constructor(private classroomStatusService: ClassroomStatusService) {
    this.reload();
  }

  async reload() {
    this.loading.set(true);
    const data = await this.classroomStatusService.list();
    this.statuses.set(data);
    this.loading.set(false);
  }

  async lockStatus(status: ClassroomStatusItem) {
    if (!confirm(`Khóa trạng thái của học sinh ${status.studentName} (${status.studentCode})?`)) return;
    
    this.loading.set(true);
    const result = await this.classroomStatusService.lock(status._id, true);
    
    if (!result.ok) {
      alert(result.message || 'Không thể khóa trạng thái');
      this.loading.set(false);
      return;
    }
    
    await this.reload();
  }

  async unlockStatus(status: ClassroomStatusItem) {
    if (!confirm(`Mở khóa trạng thái của học sinh ${status.studentName} (${status.studentCode})?`)) return;
    
    this.loading.set(true);
    const result = await this.classroomStatusService.lock(status._id, false);
    
    if (!result.ok) {
      alert(result.message || 'Không thể mở khóa trạng thái');
      this.loading.set(false);
      return;
    }
    
    await this.reload();
  }

  lockedCount(): number {
    return this.statuses().filter(s => s.isLocked).length;
  }

  activeCount(): number {
    return this.statuses().filter(s => !s.isLocked).length;
  }
}
