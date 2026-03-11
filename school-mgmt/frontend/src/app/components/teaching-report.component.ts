import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { PayrollItem, PayrollPreview, PayrollService } from '../services/payroll.service';
import { SessionService, SessionItem } from '../services/session.service';
import { UserItem, UserService } from '../services/user.service';

@Component({
  selector: 'app-teaching-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="page">
    <div class="header">
      <h2>Báo cáo giảng dạy</h2>
      <p class="subtitle">Điền nhận xét cho từng buổi học — chỉ buổi có báo cáo mới được tính lương</p>
    </div>

    <!-- Tab filter -->
    <div class="tabs">
      <button [class.active]="activeTab === 'pending'" (click)="activeTab = 'pending'; loadPending()">
        Chưa có báo cáo
        <span class="tab-count" *ngIf="pendingCount() > 0">{{ pendingCount() }}</span>
      </button>
      <button [class.active]="activeTab === 'completed'" (click)="activeTab = 'completed'; loadCompleted()">
        Đã có báo cáo
      </button>
    </div>

    <section class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>Tháng</label>
          <input type="month" [(ngModel)]="selectedMonth" (change)="onMonthChange()" />
        </div>
        <div class="filter-group">
          <label>Từ ngày</label>
          <input type="date" [(ngModel)]="fromDate" />
        </div>
        <div class="filter-group">
          <label>Đến ngày</label>
          <input type="date" [(ngModel)]="toDate" />
        </div>
        <div class="filter-group" *ngIf="!isTeacher()">
          <label>Mã giáo viên</label>
          <input
            type="text"
            [(ngModel)]="teacherCodeSearch"
            list="teacher-code-options"
            placeholder="VD: GV001"
          />
          <small class="teacher-hint" *ngIf="matchedTeacherByCode()">
            {{ matchedTeacherByCode()!.fullName }}
          </small>
          <datalist id="teacher-code-options">
            <option *ngFor="let teacher of teachers()" [value]="teacher.userCode || ''">
              {{ teacher.fullName }}
            </option>
          </datalist>
        </div>
        <button class="btn-filter" type="button" (click)="applyFilters()" [disabled]="loading()">Lọc báo cáo</button>
        <button class="btn-ghost" type="button" (click)="resetToCurrentMonth()" [disabled]="loading()">Tháng này</button>
      </div>

      <div class="salary-summary" *ngIf="payrollPreview()">
        <article class="summary-card">
          <strong>{{ payrollPreview()!.summary.totalAttended }}</strong>
          <span>Buổi đã dạy trong kỳ</span>
        </article>
        <article class="summary-card">
          <strong>{{ payrollPreview()!.summary.eligibleForPayroll }}</strong>
          <span>Buổi đủ điều kiện lương</span>
        </article>
        <article class="summary-card emphasis">
          <strong>{{ formatCurrency(payrollPreview()!.amounts.totalAttendedPayout) }}</strong>
          <span>Tổng lương buổi dạy</span>
        </article>
        <article class="summary-card emphasis success">
          <strong>{{ formatCurrency(getPaidPayrollTotal()) }}</strong>
          <span>Đã nhận lương trong kỳ</span>
        </article>
      </div>

      <ng-container *ngIf="payrollPreview()">
        <div class="accounting-note" *ngIf="accountingNotes().length; else emptyAccountingNote">
          <h3>Note kế toán</h3>
          <div class="note-item" *ngFor="let payroll of accountingNotes()">
            <div class="note-meta">
              <strong>{{ payroll.payrollCode }}</strong>
              <span>{{ payroll.periodStart | date:'dd/MM/yyyy' }} - {{ payroll.periodEnd | date:'dd/MM/yyyy' }}</span>
              <span class="note-status">{{ payrollStatusLabel(payroll.status) }}</span>
            </div>
            <p>{{ payroll.notes }}</p>
          </div>
        </div>
        <ng-template #emptyAccountingNote>
          <div class="accounting-note empty-note">
            <h3>Note kế toán</h3>
            <p>Chưa có ghi chú kế toán trong kỳ đang lọc.</p>
          </div>
        </ng-template>
      </ng-container>
    </section>

    <div *ngIf="loading()" class="loading">Đang tải...</div>
    <div *ngIf="error()" class="alert alert-error">❌ {{ error() }}</div>
    <div *ngIf="success()" class="alert alert-success">{{ success() }}</div>

    <!-- ═══ PENDING REPORT ═══ -->
    <div *ngIf="activeTab === 'pending' && !loading()">
      <div *ngIf="pendingSessions().length === 0 && !loading()" class="empty">
        🎉 Tất cả buổi học đã có báo cáo!
      </div>

      <div *ngFor="let s of pendingSessions(); trackBy: trackById" class="session-card" [class.editing]="editingId === s._id">
        <div class="session-header" (click)="handlePendingClick(s)">
          <div class="session-info" *ngIf="isTeacher(); else pendingDefaultInfo">
            <span>Ngày: {{ s.scheduledDate | date:'dd/MM/yyyy' }}</span>
            <span class="divider">|</span>
            <span>HS: {{ s.studentId.fullName || 'N/A' }}</span>
            <span class="divider">|</span>
            <span>Lớp: {{ s.classId.name || 'N/A' }}</span>
            <span class="divider">|</span>
            <span>Lương GV: {{ formatCurrency(s.teacherPayout) }}</span>
            <span class="divider">|</span>
            <span class="deadline-badge" [class.overdue]="isOverDeadline(s)" [class.near-deadline]="isNearDeadline(s)">
              {{ isOverDeadline(s) ? 'Trễ ' + getOverdueHours(s) + 'h' : 'Còn ' + getRemainingHours(s) + 'h' }}
            </span>
            <span class="divider">|</span>
            <span>{{ s.durationMinutes || 60 }} phút</span>
            <span class="divider">|</span>
            <span class="badge warning">Chưa có báo cáo</span>
            <span class="divider">|</span>
            <span class="badge" [attr.data-status]="s.status">{{ statusLabel(s.status) }}</span>
          </div>
          <ng-template #pendingDefaultInfo>
            <div class="session-info">
              <span class="badge warning">Chưa có báo cáo</span>
              <span>GV: {{ s.teacherId.fullName || 'N/A' }}</span>
              <span class="divider">|</span>
              <strong>{{ s.classId.name || 'N/A' }}</strong>
              <span class="divider">|</span>
              <span>HS: {{ s.studentId.fullName || 'N/A' }}</span>
              <span class="divider">|</span>
              <span>{{ s.scheduledDate | date:'dd/MM/yyyy' }}</span>
              <span class="divider">|</span>
              <span class="deadline-badge" [class.overdue]="isOverDeadline(s)" [class.near-deadline]="isNearDeadline(s)">
                {{ isOverDeadline(s) ? 'Trễ ' + getOverdueHours(s) + 'h' : 'Còn ' + getRemainingHours(s) + 'h' }}
              </span>
              <span class="divider">|</span>
              <span>{{ s.durationMinutes || 60 }} phút</span>
              <span class="divider">|</span>
              <span class="badge" [attr.data-status]="s.status">{{ statusLabel(s.status) }}</span>
            </div>
          </ng-template>
          <button *ngIf="canEditReports()" class="btn-expand">{{ editingId === s._id ? '▲ Thu gọn' : '▼ Điền báo cáo' }}</button>
        </div>

        <!-- Inline edit form -->
        <div *ngIf="canEditReports() && editingId === s._id" class="report-form">
          <div class="form-grid">
            <div class="form-group full" [class.has-error]="validationErrors()['lessonContent']">
              <label>Nội dung học <span class="required">*</span> <span class="char-count">{{ reportForm.lessonContent.length || 0 }}/2000</span></label>
              <textarea [(ngModel)]="reportForm.lessonContent" rows="3"
                placeholder="Mô tả nội dung đã học trong buổi... (tối thiểu 20 ký tự)"></textarea>
              <span class="error-message" *ngIf="validationErrors()['lessonContent']">{{ validationErrors()['lessonContent'] }}</span>
            </div>
            <div class="form-group" [class.has-error]="validationErrors()['studentAttitude']">
              <label>Thái độ của học sinh <span class="char-count">{{ reportForm.studentAttitude.length || 0 }}/1000</span></label>
              <textarea [(ngModel)]="reportForm.studentAttitude" rows="2"
                placeholder="Nhận xét về thái độ, hành vi..."></textarea>
              <span class="error-message" *ngIf="validationErrors()['studentAttitude']">{{ validationErrors()['studentAttitude'] }}</span>
            </div>
            <div class="form-group" [class.has-error]="validationErrors()['recordingUrl']">
              <label>Link ghi hình bài giảng</label>
              <input type="text" [(ngModel)]="reportForm.recordingUrl"
                placeholder="https://drive.google.com/...">
              <span class="error-message" *ngIf="validationErrors()['recordingUrl']">{{ validationErrors()['recordingUrl'] }}</span>
            </div>
            <div class="form-group full" [class.has-error]="validationErrors()['teacherComment']">
              <label>Nhận xét chung <span class="char-count">{{ reportForm.teacherComment.length || 0 }}/1000</span></label>
              <textarea [(ngModel)]="reportForm.teacherComment" rows="2"
                placeholder="Nhận xét tổng quan về buổi học..."></textarea>
              <span class="error-message" *ngIf="validationErrors()['teacherComment']">{{ validationErrors()['teacherComment'] }}</span>
            </div>
            <div class="form-group" [class.has-error]="validationErrors()['homework']">
              <label>Bài tập về nhà <span class="char-count">{{ reportForm.homework.length || 0 }}/1000</span></label>
              <textarea [(ngModel)]="reportForm.homework" rows="2"
                placeholder="Bài tập giao cho HS..."></textarea>
              <span class="error-message" *ngIf="validationErrors()['homework']">{{ validationErrors()['homework'] }}</span>
            </div>
            <div class="form-group" [class.has-error]="validationErrors()['additionalNotes']">
              <label>Ghi chú thêm <span class="char-count">{{ reportForm.additionalNotes.length || 0 }}/500</span></label>
              <textarea [(ngModel)]="reportForm.additionalNotes" rows="2"
                placeholder="Ghi chú khác nếu có..."></textarea>
              <span class="error-message" *ngIf="validationErrors()['additionalNotes']">{{ validationErrors()['additionalNotes'] }}</span>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="editingId = ''; validationErrors.set({})">Hủy</button>
            <button class="btn primary" (click)="submitReport(s._id)"
              [disabled]="submitting()">
              {{ submitting() ? '⏳ Đang gửi...' : '📤 Nộp báo cáo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ COMPLETED REPORT ═══ -->
    <div *ngIf="activeTab === 'completed' && !loading()">
      <div *ngIf="completedSessions().length === 0 && !loading()" class="empty">
        Chưa có buổi học nào đã nộp báo cáo.
      </div>

      <div *ngFor="let s of completedSessions(); trackBy: trackById" class="session-card completed">
        <div class="session-header" (click)="toggleView(s)">
          <div class="session-info" *ngIf="isTeacher(); else completedDefaultInfo">
            <span>Ngày: {{ s.scheduledDate | date:'dd/MM/yyyy' }}</span>
            <span class="divider">|</span>
            <span>HS: {{ s.studentId.fullName || 'N/A' }}</span>
            <span class="divider">|</span>
            <span>Lớp: {{ s.classId.name || 'N/A' }}</span>
            <span class="divider">|</span>
            <span>Lương GV: {{ formatCurrency(s.teacherPayout) }}</span>
            <span class="divider">|</span>
            <span>{{ s.durationMinutes || 60 }} phút</span>
            <span class="divider">|</span>
            <span class="badge success">Đã có báo cáo</span>
          </div>
          <ng-template #completedDefaultInfo>
            <div class="session-info">
              <span class="badge success">Đã có báo cáo</span>
              <span>GV: {{ s.teacherId.fullName || 'N/A' }}</span>
              <span class="divider">|</span>
              <strong>{{ s.classId.name || 'N/A' }}</strong>
              <span class="divider">|</span>
              <span>HS: {{ s.studentId.fullName || 'N/A' }}</span>
              <span class="divider">|</span>
              <span>{{ s.scheduledDate | date:'dd/MM/yyyy' }}</span>
              <span class="divider">|</span>
              <span>{{ s.durationMinutes || 60 }} phút</span>
            </div>
          </ng-template>
          <button class="btn-expand">{{ viewingId === s._id ? '▲ Thu gọn' : '▼ Xem' }}</button>
        </div>

        <!-- View report (readonly or editable) -->
        <div *ngIf="viewingId === s._id" class="report-view">
          <div *ngIf="editingId !== s._id">
            <table class="report-table">
              <tr><th>Nội dung học</th><td>{{ s.teachingReport?.lessonContent || '—' }}</td></tr>
              <tr><th>Thái độ HS</th><td>{{ s.teachingReport?.studentAttitude || '—' }}</td></tr>
              <tr><th>Link ghi hình</th><td>
                <a *ngIf="s.teachingReport?.recordingUrl" [href]="s.teachingReport?.recordingUrl" target="_blank">{{ s.teachingReport?.recordingUrl }}</a>
                <span *ngIf="!s.teachingReport?.recordingUrl">—</span>
              </td></tr>
              <tr><th>Nhận xét</th><td>{{ s.teachingReport?.teacherComment || '—' }}</td></tr>
              <tr><th>Bài tập</th><td>{{ s.teachingReport?.homework || '—' }}</td></tr>
              <tr><th>Ghi chú</th><td>{{ s.teachingReport?.additionalNotes || '—' }}</td></tr>
              <tr><th>Ngày nộp</th><td>{{ s.teachingReport?.submittedAt | date:'dd/MM/yyyy HH:mm' }}</td></tr>
              <tr *ngIf="s.teachingReport?.isLateSubmission">
                <th>Tình trạng</th>
                <td><span class="badge late-badge">Nộp muộn {{ getLateHours(s) }}h</span></td>
              </tr>
            </table>
            <div class="form-actions">
              <button *ngIf="canEditReports()" class="btn secondary" (click)="startEdit(s)">Sửa báo cáo</button>
            </div>
          </div>

          <!-- Edit mode for completed -->
          <div *ngIf="canEditReports() && editingId === s._id" class="report-form">
            <div class="form-grid">
              <div class="form-group full">
                <label>Nội dung học <span class="required">*</span></label>
                <textarea [(ngModel)]="reportForm.lessonContent" rows="3"></textarea>
              </div>
              <div class="form-group">
                <label>Thái độ của học sinh</label>
                <textarea [(ngModel)]="reportForm.studentAttitude" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label>Link ghi hình bài giảng</label>
                <input type="text" [(ngModel)]="reportForm.recordingUrl">
              </div>
              <div class="form-group full">
                <label>Nhận xét chung</label>
                <textarea [(ngModel)]="reportForm.teacherComment" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label>Bài tập về nhà</label>
                <textarea [(ngModel)]="reportForm.homework" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label>Ghi chú thêm</label>
                <textarea [(ngModel)]="reportForm.additionalNotes" rows="2"></textarea>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn secondary" (click)="editingId = ''">Hủy</button>
              <button class="btn primary" (click)="submitReport(s._id)"
                [disabled]="!reportForm.lessonContent.trim() || submitting()">
                {{ submitting() ? 'Đang gửi...' : 'Cập nhật báo cáo' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="completedMeta().totalPages > 1">
        <button (click)="completedPage = completedPage - 1; loadCompleted()" [disabled]="completedPage <= 1">← Trước</button>
        <span>Trang {{ completedPage }} / {{ completedMeta().totalPages }}</span>
        <button (click)="completedPage = completedPage + 1; loadCompleted()" [disabled]="completedPage >= completedMeta().totalPages">Sau →</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .header h2 { margin: 0 0 4px; color: #1e293b; font-size: 20px; }
    .subtitle { margin: 0 0 16px; color: #64748b; font-size: 14px; }
    .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .tabs button {
      padding: 10px 20px; border: none; background: transparent; cursor: pointer;
      font-size: 14px; font-weight: 600; color: #64748b; border-bottom: 3px solid transparent;
      transition: all 0.2s; position: relative;
    }
    .tabs button:hover { color: #1e293b; }
    .tabs button.active { color: #2563eb; border-bottom-color: #2563eb; }
    .tab-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px;
      background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
      margin-left: 6px; line-height: 1;
    }
    .filter-panel {
      margin-bottom: 16px; padding: 16px; border: 1px solid #e2e8f0;
      border-radius: 10px; background: #f8fafc;
    }
    .filter-row {
      display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-group label { font-size: 12px; font-weight: 600; color: #64748b; }
    .filter-group input {
      min-width: 150px; padding: 8px 10px; border: 1px solid #cbd5e1;
      border-radius: 6px; font-size: 13px; background: #fff;
    }
    .teacher-hint { color: #475569; font-size: 11px; }
    .btn-filter, .btn-ghost {
      height: 38px; padding: 0 16px; border-radius: 6px;
      font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-filter {
      border: none; background: #2563eb; color: #fff;
    }
    .btn-filter:disabled, .btn-ghost:disabled { cursor: not-allowed; opacity: 0.7; }
    .btn-ghost {
      border: 1px solid #cbd5e1; background: #fff; color: #475569;
    }
    .salary-summary {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px; margin-bottom: 14px;
    }
    .summary-card {
      display: flex; flex-direction: column; gap: 4px; padding: 14px;
      border-radius: 10px; background: #fff; border: 1px solid #e2e8f0;
    }
    .summary-card strong { color: #0f172a; font-size: 20px; }
    .summary-card span { color: #64748b; font-size: 12px; font-weight: 600; }
    .summary-card.emphasis { background: #eff6ff; border-color: #bfdbfe; }
    .summary-card.emphasis strong { color: #1d4ed8; }
    .summary-card.success { background: #ecfdf5; border-color: #bbf7d0; }
    .summary-card.success strong { color: #15803d; }
    .accounting-note {
      padding: 14px; border-radius: 10px; background: #fff;
      border: 1px solid #e2e8f0;
    }
    .accounting-note h3 {
      margin: 0 0 10px; color: #1e293b; font-size: 15px;
    }
    .note-item {
      padding-top: 10px; margin-top: 10px; border-top: 1px solid #e2e8f0;
    }
    .note-item:first-of-type {
      padding-top: 0; margin-top: 0; border-top: none;
    }
    .note-meta {
      display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
      margin-bottom: 6px; font-size: 12px; color: #64748b;
    }
    .note-meta strong { color: #0f172a; }
    .note-status {
      display: inline-flex; align-items: center; padding: 3px 8px;
      border-radius: 999px; background: #e2e8f0; color: #475569;
      font-weight: 700; font-size: 11px;
    }
    .accounting-note p {
      margin: 0; color: #334155; font-size: 13px; line-height: 1.5;
    }
    .empty-note p { color: #64748b; }
    .loading { text-align: center; padding: 40px; color: #64748b; }
    
    /* Alert styles */
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; font-weight: 500; }
    .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
    .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; }
    
    .empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 15px; }

    .session-card {
      background: #fff; border-radius: 10px; margin-bottom: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 4px solid #f97316;
      overflow: hidden;
    }
    .session-card.completed { border-left-color: #22c55e; }
    .session-card.editing { border-left-color: #2563eb; }

    .session-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; cursor: pointer; transition: background 0.15s;
    }
    .session-header:hover { background: #f8fafc; }
    .session-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #475569; }
    .session-info strong { color: #1e293b; }
    .divider { color: #cbd5e1; }

    .btn-expand {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;
      cursor: pointer; font-size: 12px; font-weight: 600; color: #475569; white-space: nowrap;
    }
    .btn-expand:hover { background: #f1f5f9; }

    .badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge.warning { background: #fef9c3; color: #b45309; }
    .badge.success { background: #dcfce7; color: #16a34a; }
    .badge[data-status="FINALIZED"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="TEACHER_COMPLETED"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="PARENT_CONFIRMED"] { background: #e0e7ff; color: #4f46e5; }
    .badge[data-status="SCHEDULED"] { background: #f1f5f9; color: #64748b; }
    .deadline-badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #16a34a; }
    .deadline-badge.near-deadline { background: #fef9c3; color: #b45309; }
    .deadline-badge.overdue { background: #fee2e2; color: #dc2626; }
    .badge.late-badge { background: #fee2e2; color: #dc2626; }

    .report-form, .report-view { padding: 0 18px 18px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; position: relative; }
    .form-group.full { grid-column: 1 / -1; }
    .form-group label { font-size: 13px; font-weight: 600; color: #475569; display: flex; justify-content: space-between; align-items: center; }
    .required { color: #ef4444; }
    .char-count { font-size: 11px; font-weight: 400; color: #94a3b8; }
    .form-group textarea, .form-group input {
      padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px;
      font-size: 14px; font-family: inherit; resize: vertical; transition: all 0.15s;
    }
    .form-group textarea:focus, .form-group input:focus {
      outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .form-group.has-error textarea, .form-group.has-error input {
      border-color: #ef4444; background: #fef2f2;
    }
    .form-group.has-error textarea:focus, .form-group.has-error input:focus {
      box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
    }
    .error-message {
      font-size: 12px; color: #dc2626; margin-top: 4px; display: block;
      animation: shake 0.3s ease-in-out;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
    .btn {
      padding: 8px 18px; border: none; border-radius: 6px; cursor: pointer;
      font-size: 14px; font-weight: 600; transition: all 0.15s;
    }
    .btn.primary { background: #2563eb; color: #fff; }
    .btn.primary:hover { background: #1d4ed8; }
    .btn.primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .btn.secondary { background: #f1f5f9; color: #475569; }
    .btn.secondary:hover { background: #e2e8f0; }

    .report-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .report-table th { text-align: left; padding: 8px 12px; background: #f8fafc; color: #64748b; font-size: 12px; width: 140px; font-weight: 600; white-space: nowrap; }
    .report-table td { padding: 8px 12px; color: #1e293b; word-break: break-word; }
    .report-table tr { border-bottom: 1px solid #f1f5f9; }
    .report-table a { color: #2563eb; text-decoration: none; }
    .report-table a:hover { text-decoration: underline; }

    .pagination { display: flex; gap: 12px; align-items: center; justify-content: center; padding: 20px 0; }
    .pagination button {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; cursor: pointer; font-size: 13px;
    }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination span { font-size: 13px; color: #64748b; }

    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; }
      .filter-row { align-items: stretch; }
      .filter-group, .filter-group input, .btn-filter, .btn-ghost { width: 100%; }
      .session-header { flex-direction: column; align-items: flex-start; gap: 10px; }
      .btn-expand { width: 100%; }
    }
  `]
})
export class TeachingReportComponent implements OnInit {
  teachers = signal<UserItem[]>([]);
  pendingSessions = signal<SessionItem[]>([]);
  completedSessions = signal<SessionItem[]>([]);
  pendingCount = signal(0);
  completedMeta = signal<any>({});
  payrollPreview = signal<PayrollPreview | null>(null);
  loading = signal(false);
  submitting = signal(false);
  error = signal('');
  success = signal('');
  activeTab = 'pending';
  editingId = '';
  viewingId = '';
  completedPage = 1;
  selectedMonth = '';
  fromDate = '';
  toDate = '';
  teacherCodeSearch = '';
  selectedTeacherId = '';
  validationErrors = signal<Record<string, string>>({});

  reportForm = {
    lessonContent: '',
    studentAttitude: '',
    recordingUrl: '',
    teacherComment: '',
    homework: '',
    additionalNotes: '',
  };

  constructor(
    private sessionService: SessionService,
    private auth: AuthService,
    private payrollService: PayrollService,
    private userService: UserService,
  ) {}

  ngOnInit() {
    if (!this.isTeacher()) {
      this.loadTeacherOptions();
    }
    this.resetToCurrentMonth();
  }

  async loadPending() {
    this.loading.set(true);
    this.error.set('');
    try {
      await Promise.all([this.fetchPending(), this.fetchPayrollPreview()]);
    } catch (e: any) {
      this.error.set(e?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  async loadCompleted() {
    this.loading.set(true);
    this.error.set('');
    try {
      await Promise.all([this.fetchCompleted(), this.fetchPayrollPreview()]);
    } catch (e: any) {
      this.error.set(e?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  onMonthChange() {
    if (!this.selectedMonth) return;
    const [year, month] = this.selectedMonth.split('-').map(Number);
    if (!year || !month) return;
    const lastDay = new Date(year, month, 0).getDate();
    this.fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    this.toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    this.applyFilters();
  }

  resetToCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.selectedMonth = `${year}-${String(month).padStart(2, '0')}`;
    const lastDay = new Date(year, month, 0).getDate();
    this.fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    this.toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    this.applyFilters();
  }

  async applyFilters(resetPage = true) {
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.error.set('Khoảng ngày không hợp lệ');
      return;
    }

    if (!this.syncTeacherSelection()) {
      return;
    }

    if (resetPage) this.completedPage = 1;
    this.loading.set(true);
    this.error.set('');
    this.editingId = '';
    this.viewingId = '';

    try {
      await Promise.all([
        this.fetchPending(),
        this.fetchCompleted(),
        this.fetchPayrollPreview(),
      ]);
    } catch (e: any) {
      this.error.set(e?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchPending() {
    const result = await this.sessionService.list({
      limit: 100,
      hasReport: 'false',
      teacherId: this.getSelectedTeacherId() || undefined,
      fromDate: this.fromDate || undefined,
      toDate: this.toDate || undefined,
    });
    this.pendingSessions.set(result.data);
    this.pendingCount.set(result.meta?.total || result.data.length);
  }

  private async fetchCompleted() {
    const result = await this.sessionService.list({
      page: this.completedPage,
      limit: 20,
      hasReport: 'true',
      teacherId: this.getSelectedTeacherId() || undefined,
      fromDate: this.fromDate || undefined,
      toDate: this.toDate || undefined,
    });
    this.completedSessions.set(result.data);
    this.completedMeta.set(result.meta || {});
  }

  private async fetchPayrollPreview() {
    const teacherId = this.getSelectedTeacherId();
    if (!teacherId || !this.fromDate || !this.toDate) {
      this.payrollPreview.set(null);
      return;
    }

    const preview = await this.payrollService.getTeacherPreview(teacherId, this.fromDate, this.toDate);
    this.payrollPreview.set(preview);
  }

  private async loadTeacherOptions() {
    const teachers = await this.userService.listTeachers();
    this.teachers.set(teachers);
  }

  private syncTeacherSelection(): boolean {
    if (this.isTeacher()) {
      this.selectedTeacherId = this.auth.userSignal()?.sub || '';
      return true;
    }

    const teacherCode = this.teacherCodeSearch.trim().toLowerCase();
    if (!teacherCode) {
      this.selectedTeacherId = '';
      return true;
    }

    const exactMatch = this.teachers().find(
      (teacher) => (teacher.userCode || '').trim().toLowerCase() === teacherCode,
    );
    if (exactMatch) {
      this.selectedTeacherId = exactMatch._id;
      return true;
    }

    this.selectedTeacherId = '';
    this.error.set('Không tìm thấy giáo viên theo mã đã nhập');
    return false;
  }

  private getSelectedTeacherId(): string {
    return this.isTeacher() ? (this.auth.userSignal()?.sub || '') : this.selectedTeacherId;
  }

  matchedTeacherByCode(): UserItem | null {
    if (!this.teacherCodeSearch.trim()) return null;
    return this.teachers().find(
      (teacher) =>
        (teacher.userCode || '').trim().toLowerCase() === this.teacherCodeSearch.trim().toLowerCase(),
    ) || null;
  }

  canEditReports(): boolean {
    return this.isTeacher();
  }

  handlePendingClick(session: SessionItem) {
    if (!this.canEditReports()) return;
    this.toggleEdit(session);
  }

  toggleEdit(session: SessionItem) {
    if (this.editingId === session._id) {
      this.editingId = '';
    } else {
      this.editingId = session._id;
      this.resetForm();
    }
  }

  toggleView(session: SessionItem) {
    if (this.viewingId === session._id) {
      this.viewingId = '';
      this.editingId = '';
    } else {
      this.viewingId = session._id;
      this.editingId = '';
    }
  }

  startEdit(session: SessionItem) {
    if (!this.canEditReports()) return;
    this.editingId = session._id;
    this.reportForm = {
      lessonContent: session.teachingReport?.lessonContent || '',
      studentAttitude: session.teachingReport?.studentAttitude || '',
      recordingUrl: session.teachingReport?.recordingUrl || '',
      teacherComment: session.teachingReport?.teacherComment || '',
      homework: session.teachingReport?.homework || '',
      additionalNotes: session.teachingReport?.additionalNotes || '',
    };
  }

  resetForm() {
    this.reportForm = {
      lessonContent: '',
      studentAttitude: '',
      recordingUrl: '',
      teacherComment: '',
      homework: '',
      additionalNotes: '',
    };
  }

  validateForm(): boolean {
    const errors: Record<string, string> = {};
    
    // Validate lessonContent (required, min 20, max 2000)
    if (!this.reportForm.lessonContent?.trim()) {
      errors['lessonContent'] = 'Nội dung học không được để trống';
    } else if (this.reportForm.lessonContent.length < 20) {
      errors['lessonContent'] = 'Nội dung học phải có ít nhất 20 ký tự';
    } else if (this.reportForm.lessonContent.length > 2000) {
      errors['lessonContent'] = 'Nội dung học không được vượt quá 2000 ký tự';
    }
    
    // Validate recordingUrl (optional but must be valid URL if provided)
    if (this.reportForm.recordingUrl?.trim()) {
      try {
        new URL(this.reportForm.recordingUrl);
      } catch (e) {
        errors['recordingUrl'] = 'Link ghi hình phải là URL hợp lệ (https://...)';
      }
    }
    
    // Validate text lengths
    if (this.reportForm.studentAttitude && this.reportForm.studentAttitude.length > 1000) {
      errors['studentAttitude'] = 'Thái độ học sinh không được vượt quá 1000 ký tự';
    }
    if (this.reportForm.teacherComment && this.reportForm.teacherComment.length > 1000) {
      errors['teacherComment'] = 'Nhận xét không được vượt quá 1000 ký tự';
    }
    if (this.reportForm.homework && this.reportForm.homework.length > 1000) {
      errors['homework'] = 'Bài tập về nhà không được vượt quá 1000 ký tự';
    }
    if (this.reportForm.additionalNotes && this.reportForm.additionalNotes.length > 500) {
      errors['additionalNotes'] = 'Ghi chú thêm không được vượt quá 500 ký tự';
    }
    
    this.validationErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  async submitReport(sessionId: string) {
    if (!this.canEditReports()) return;

    // Validate form
    if (!this.validateForm()) {
      this.error.set('Vui lòng kiểm tra lại thông tin đã nhập');
      return;
    }
    
    this.submitting.set(true);
    this.error.set('');
    this.success.set('');
    
    try {
      await this.sessionService.submitTeachingReport(sessionId, this.reportForm);
      this.success.set('Nộp báo cáo thành công! ✓');
      this.editingId = '';
      this.viewingId = '';
      this.validationErrors.set({});
      
      // Clear success message after 3s
      setTimeout(() => this.success.set(''), 3000);
      
      await this.applyFilters(false);
    } catch (e: any) {
      // Parse detailed error from backend
      if (e?.error?.message) {
        this.error.set(Array.isArray(e.error.message) ? e.error.message.join('; ') : e.error.message);
      } else if (e?.message) {
        this.error.set(e.message);
      } else {
        this.error.set('Lỗi gửi báo cáo. Vui lòng kiểm tra kết nối mạng và thử lại.');
      }
      
      // Auto-hide error after 5s
      setTimeout(() => this.error.set(''), 5000);
    } finally {
      this.submitting.set(false);
    }
  }

  trackById(index: number, item: SessionItem) {
    return item._id;
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Đã lên lịch', TEACHER_COMPLETED: 'GV hoàn thành',
      PARENT_CONFIRMED: 'PH xác nhận', FINALIZED: 'Hoàn tất',
      CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng',
    };
    return map[s] || s;
  }

  isTeacher() {
    return this.auth.userSignal()?.role === 'TEACHER';
  }

  formatCurrency(amount?: number): string {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  getPaidPayrollTotal(): number {
    return (this.payrollPreview()?.existingPayrolls || [])
      .filter((payroll) => payroll.status === 'PAID')
      .reduce((total, payroll) => total + (payroll.netAmount || 0), 0);
  }

  accountingNotes(): PayrollItem[] {
    return (this.payrollPreview()?.existingPayrolls || []).filter(
      (payroll) => !!payroll.notes?.trim(),
    );
  }

  payrollStatusLabel(status?: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Nháp',
      PENDING_REVIEW: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      PAID: 'Đã chi',
      REJECTED: 'Từ chối',
    };
    return map[status || ''] || status || 'Khác';
  }

  // ─── Deadline helpers (24h window after scheduledDate) ───────────────

  getDeadlineMs(session: SessionItem): number {
    return new Date(session.scheduledDate).getTime() + 24 * 60 * 60 * 1000;
  }

  isOverDeadline(session: SessionItem): boolean {
    return Date.now() > this.getDeadlineMs(session);
  }

  isNearDeadline(session: SessionItem): boolean {
    const remaining = this.getDeadlineMs(session) - Date.now();
    return remaining > 0 && remaining < 4 * 60 * 60 * 1000;
  }

  getRemainingHours(session: SessionItem): number {
    return Math.ceil((this.getDeadlineMs(session) - Date.now()) / (60 * 60 * 1000));
  }

  getOverdueHours(session: SessionItem): number {
    return Math.floor((Date.now() - this.getDeadlineMs(session)) / (60 * 60 * 1000));
  }

  getLateHours(session: SessionItem): number {
    const report = session.teachingReport as any;
    const submitted = report?.submittedAt ? new Date(report.submittedAt).getTime() : Date.now();
    return Math.max(0, Math.floor((submitted - this.getDeadlineMs(session)) / (60 * 60 * 1000)));
  }
}
