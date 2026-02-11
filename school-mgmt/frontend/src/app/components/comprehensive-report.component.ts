import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentService, ComprehensiveReportRow, ComprehensiveReportResponse, SessionCell } from '../services/student.service';
import { ClassService, ClassItem } from '../services/class.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-comprehensive-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="report-container">
      <h1>Báo cáo tổng hợp học sinh</h1>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <label>Lọc theo lớp:</label>
          <select [(ngModel)]="selectedClassId" (change)="loadReport()">
            <option value="">Tất cả lớp</option>
            <option *ngFor="let cls of classes()" [value]="cls._id">
              {{ cls.code }} - {{ cls.name }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Tìm kiếm:</label>
          <input
            type="text"
            [(ngModel)]="searchTerm"
            (input)="onSearchInput()"
            placeholder="Tên HS, mã HS, phụ huynh, SĐT..."
          />
        </div>

        <button class="btn btn-primary" (click)="loadReport()">
          Tìm kiếm
        </button>

        <button class="btn btn-export" (click)="exportCSV()">
          Xuất CSV
        </button>
      </div>

      <!-- Loading & Error -->
      <div *ngIf="loading()" class="loading">Đang tải dữ liệu...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <!-- Summary -->
      <div *ngIf="!loading() && reportRows().length > 0" class="report-summary">
        <div class="summary-card">
          <h3>Tổng số dòng</h3>
          <p class="summary-number">{{ reportRows().length }}</p>
        </div>
        <div class="summary-card">
          <h3>Số lớp</h3>
          <p class="summary-number">{{ uniqueClasses() }}</p>
        </div>
        <div class="summary-card">
          <h3>Buổi tối đa</h3>
          <p class="summary-number">{{ maxSessions() }}</p>
        </div>
        <div class="summary-card">
          <h3>Tổng lượt có mặt</h3>
          <p class="summary-number">{{ totalAttended() }}</p>
        </div>
      </div>

      <!-- Tables: split every 20 sessions -->
      <ng-container *ngFor="let chunk of sessionChunks(); let ci = index">
        <h2 class="chunk-title" *ngIf="sessionChunks().length > 1">
          Buổi {{ chunk.start + 1 }} – {{ chunk.end }}
        </h2>
        <div class="report-table-container">
          <table class="report-table">
            <thead>
              <tr>
                <!-- fixed cols only in first chunk, otherwise just STT + code + name -->
                <th class="sticky-col col-stt">STT</th>
                <th class="sticky-col col-code">Mã HS</th>
                <th class="sticky-col col-name">Tên học sinh</th>
                <ng-container *ngIf="ci === 0">
                  <th>Tuổi</th>
                  <th>Phụ huynh</th>
                  <th>SĐT</th>
                  <th>Mã lớp</th>
                  <th>Tên lớp</th>
                  <th>Môn học</th>
                  <th>Giáo viên</th>
                  <th>Giá/buổi</th>
                  <th>Tổng buổi</th>
                  <th>Đã học</th>
                  <th>Có mặt</th>
                  <th>Vắng</th>
                </ng-container>
                <th
                  *ngFor="let si of chunk.indices"
                  class="session-col"
                >
                  Buổi {{ si + 1 }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of reportRows(); let i = index">
                <td class="sticky-col col-stt">{{ i + 1 }}</td>
                <td class="sticky-col col-code">{{ row.studentCode }}</td>
                <td class="sticky-col col-name"><strong>{{ row.fullName }}</strong></td>
                <ng-container *ngIf="ci === 0">
                  <td>{{ row.age || '-' }}</td>
                  <td>{{ row.parentName }}</td>
                  <td>{{ row.parentPhone }}</td>
                  <td class="class-code">{{ row.classCode }}</td>
                  <td>{{ row.className }}</td>
                  <td>{{ row.subject || '-' }}</td>
                  <td>{{ row.teacherName }}</td>
                  <td class="number-cell">{{ formatCurrency(row.pricePerSession) }}</td>
                  <td class="number-cell">{{ row.totalSessions || '-' }}</td>
                  <td class="number-cell">{{ row.sessionsCompleted }}</td>
                  <td class="number-cell">
                    <span class="badge badge-success">{{ row.attendedCount }}</span>
                  </td>
                  <td class="number-cell">
                    <span class="badge badge-danger" *ngIf="row.absentCount > 0">{{ row.absentCount }}</span>
                    <span *ngIf="row.absentCount === 0">0</span>
                  </td>
                </ng-container>
                <td
                  *ngFor="let si of chunk.indices"
                  class="session-cell"
                  [ngClass]="getSessionCellClass(row.sessions[si])"
                >
                  <ng-container *ngIf="row.sessions[si] as s">
                    <div class="cell-status">{{ getStatusLabel(s.status) }}</div>
                    <div class="cell-date">{{ formatDateShort(s.date) }}</div>
                    <div class="cell-detail">{{ s.duration }}p</div>
                    <div class="cell-teacher" [title]="s.teacherCode">{{ truncate(s.teacherCode, 10) }}</div>
                  </ng-container>
                  <ng-container *ngIf="!row.sessions[si]">
                    <span class="cell-empty">-</span>
                  </ng-container>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <div *ngIf="!loading() && reportRows().length === 0 && !error()" class="no-data">
        Không tìm thấy dữ liệu phù hợp. Hãy chọn lớp hoặc thay đổi từ khóa tìm kiếm.
      </div>
    </div>
  `,
  styles: [`
    .report-container { padding: 2rem; max-width: 100%; margin: 0 auto; }
    h1 { color: #1f2937; margin-bottom: 1.5rem; }
    .chunk-title { color: #374151; margin: 24px 0 12px; font-size: 18px; }

    .filters {
      display: flex; gap: 16px; flex-wrap: wrap;
      background: white; padding: 20px; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px;
      align-items: flex-end;
    }
    .filter-group {
      display: flex; flex-direction: column; gap: 8px;
      flex: 1; min-width: 200px;
    }
    .filter-group label { font-weight: 600; color: #374151; font-size: 14px; }
    .filter-group select, .filter-group input {
      padding: 10px 12px; border: 1px solid #d1d5db;
      border-radius: 6px; font-size: 14px;
    }

    .btn {
      padding: 10px 20px; border: none; border-radius: 6px;
      cursor: pointer; font-weight: 600; font-size: 14px;
      white-space: nowrap;
    }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-export { background: #10b981; color: white; }
    .btn-export:hover { background: #059669; }

    .loading, .error, .no-data {
      text-align: center; padding: 40px; background: white;
      border-radius: 8px; margin: 20px 0;
    }
    .error { color: #dc2626; }

    .report-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px; margin-bottom: 24px;
    }
    .summary-card {
      background: white; padding: 20px; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center;
    }
    .summary-card h3 {
      font-size: 12px; color: #6b7280; margin-bottom: 8px;
      font-weight: 600; text-transform: uppercase;
    }
    .summary-number { font-size: 28px; font-weight: 700; color: #1f2937; margin: 0; }

    .report-table-container {
      background: white; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow-x: auto; max-width: 100%;
      margin-bottom: 24px;
    }

    .report-table { width: max-content; min-width: 100%; border-collapse: collapse; }

    .report-table thead { background: #f9fafb; border-bottom: 2px solid #e5e7eb; }
    .report-table th {
      padding: 10px 8px; text-align: center; font-weight: 600;
      color: #374151; font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.3px; white-space: nowrap;
    }
    .report-table td {
      padding: 6px 8px; border-bottom: 1px solid #e5e7eb;
      color: #1f2937; font-size: 13px; white-space: nowrap;
    }
    .report-table tbody tr:hover { background: #f9fafb; }

    /* Sticky first 3 columns */
    .sticky-col { position: sticky; background: white; z-index: 2; }
    thead .sticky-col { background: #f9fafb; z-index: 3; }
    .col-stt { left: 0; min-width: 44px; }
    .col-code { left: 44px; min-width: 90px; }
    .col-name { left: 134px; min-width: 150px; border-right: 2px solid #e5e7eb; }

    .class-code { font-weight: 600; color: #2563eb; }
    .number-cell { text-align: center; }

    .session-col {
      min-width: 110px; text-align: center; font-size: 12px;
      background: #eef2ff;
    }

    .session-cell {
      text-align: center; min-width: 110px; vertical-align: top;
      padding: 4px 6px !important; line-height: 1.3;
    }
    .cell-status { font-size: 12px; font-weight: 700; }
    .cell-date { font-size: 11px; color: #6b7280; }
    .cell-detail { font-size: 11px; color: #374151; font-weight: 600; }
    .cell-teacher { font-size: 10px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; }
    .cell-empty { color: #d1d5db; }

    .sc-present { background: #d1fae5; }
    .sc-absent { background: #fee2e2; }
    .sc-late { background: #fef3c7; }
    .sc-excused { background: #dbeafe; }
    .sc-empty { background: #f9fafb; }

    .badge {
      padding: 4px 10px; border-radius: 10px; font-weight: 600; font-size: 12px;
    }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
  `]
})
export class ComprehensiveReportComponent implements OnInit {
  private studentService = inject(StudentService);
  private classService = inject(ClassService);

  reportRows = signal<ComprehensiveReportRow[]>([]);
  maxSessions = signal(0);
  classes = signal<ClassItem[]>([]);
  loading = signal(false);
  error = signal('');

  selectedClassId = '';
  searchTerm = '';

  private searchTimeout: any;

  /** Split session indices into chunks of 20 for display */
  sessionChunks = computed(() => {
    const max = this.maxSessions();
    if (max === 0) return [];
    const chunks: { start: number; end: number; indices: number[] }[] = [];
    for (let i = 0; i < max; i += 20) {
      const end = Math.min(i + 20, max);
      const indices: number[] = [];
      for (let j = i; j < end; j++) indices.push(j);
      chunks.push({ start: i, end, indices });
    }
    return chunks;
  });

  async ngOnInit() {
    this.loadClasses();
    this.loadReport();
  }

  async loadClasses(): Promise<void> {
    try {
      const classes = await this.classService.list();
      this.classes.set(classes);
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  }

  onSearchInput() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.loadReport(), 400);
  }

  async loadReport() {
    this.loading.set(true);
    this.error.set('');

    try {
      const data: ComprehensiveReportResponse = await this.studentService.getComprehensiveReport(
        this.selectedClassId || undefined,
        this.searchTerm || undefined
      );
      this.maxSessions.set(data.maxSessions);
      this.reportRows.set(data.rows);
    } catch (err: any) {
      this.error.set(err.message || 'Không thể tải báo cáo');
    } finally {
      this.loading.set(false);
    }
  }

  uniqueClasses(): number {
    return new Set(this.reportRows().map(r => r.classCode)).size;
  }

  totalAttended(): number {
    return this.reportRows().reduce((sum, r) => sum + r.attendedCount, 0);
  }

  formatDateShort(dateStr: string | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  formatCurrency(value: number): string {
    if (!value) return '-';
    return value.toLocaleString('vi-VN') + 'đ';
  }

  getStatusLabel(status: string | null): string {
    switch (status) {
      case 'PRESENT': return 'CM';
      case 'ABSENT': return 'V';
      case 'LATE': return 'M';
      case 'EXCUSED': return 'CP';
      default: return '-';
    }
  }

  getSessionCellClass(session?: SessionCell): string {
    if (!session) return 'sc-empty';
    switch (session.status) {
      case 'PRESENT': return 'sc-present';
      case 'ABSENT': return 'sc-absent';
      case 'LATE': return 'sc-late';
      case 'EXCUSED': return 'sc-excused';
      default: return 'sc-empty';
    }
  }

  truncate(value: string, max: number): string {
    if (!value) return '';
    return value.length > max ? value.substring(0, max) + '…' : value;
  }

  exportCSV() {
    const rows = this.reportRows();
    const max = this.maxSessions();
    if (rows.length === 0) return;

    const headers = [
      'STT', 'Mã HS', 'Tên học sinh', 'Tuổi', 'Phụ huynh', 'SĐT',
      'Mã lớp', 'Tên lớp', 'Môn học', 'Giáo viên', 'Giá/buổi',
      'Tổng buổi', 'Đã học', 'Có mặt', 'Vắng',
    ];
    for (let i = 1; i <= max; i++) {
      headers.push(`Buổi ${i} - Ngày`, `Buổi ${i} - TT`, `Buổi ${i} - Thời lượng`, `Buổi ${i} - GV`);
    }

    const csvRows = [headers.join(',')];
    rows.forEach((row, idx) => {
      const cells: (string | number)[] = [
        idx + 1,
        this.csvEscape(row.studentCode),
        this.csvEscape(row.fullName),
        row.age || '',
        this.csvEscape(row.parentName),
        this.csvEscape(row.parentPhone),
        this.csvEscape(row.classCode),
        this.csvEscape(row.className),
        this.csvEscape(row.subject),
        this.csvEscape(row.teacherName),
        row.pricePerSession || '',
        row.totalSessions || '',
        row.sessionsCompleted,
        row.attendedCount,
        row.absentCount,
      ];
      for (let i = 0; i < max; i++) {
        const s = row.sessions[i];
        if (s) {
          cells.push(s.date || '', s.status || '', s.duration ? `${s.duration}p` : '', this.csvEscape(s.teacherCode));
        } else {
          cells.push('', '', '', '');
        }
      }
      csvRows.push(cells.join(','));
    });

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-tong-hop-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private csvEscape(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
