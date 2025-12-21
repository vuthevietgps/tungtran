import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentService, StudentReportEntry } from '../services/student.service';
import { ClassService, ClassItem } from '../services/class.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-student-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="report-container">
      <h1>Báo cáo học sinh</h1>

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
            (input)="loadReport()"
            placeholder="Tên học sinh, phụ huynh, SĐT..."
          />
        </div>

        <button class="btn btn-primary" (click)="loadReport()">
          🔍 Tìm kiếm
        </button>
      </div>

      <!-- Loading & Error -->
      <div *ngIf="loading()" class="loading">Đang tải dữ liệu...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <!-- Summary -->
      <div *ngIf="!loading() && reportData().length > 0" class="report-summary">
        <div class="summary-card">
          <h3>Tổng số học sinh</h3>
          <p class="summary-number">{{ reportData().length }}</p>
        </div>
        <div class="summary-card">
          <h3>Tổng lượt điểm danh</h3>
          <p class="summary-number">{{ getTotalAttendance() }}</p>
        </div>
      </div>

      <!-- Report Table -->
      <div *ngIf="reportData().length > 0" class="report-table-container">
        <table class="report-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Ảnh</th>
              <th>Mã học sinh</th>
              <th>Tên học sinh</th>
              <th>Tuổi</th>
              <th>Phụ huynh</th>
              <th>Số điện thoại</th>
              <th>Gói sản phẩm</th>
              <th>Số buổi điểm danh</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reportData(); let i = index">
              <td>{{ i + 1 }}</td>
              <td class="image-cell">
                <img
                  *ngIf="item.faceImage"
                  [src]="getImageUrl(item.faceImage)"
                  alt="Ảnh học sinh"
                  (click)="showImageModal(getImageUrl(item.faceImage))"
                  class="student-avatar"
                />
                <span *ngIf="!item.faceImage" class="no-image">Không có ảnh</span>
              </td>
              <td>{{ item.studentCode }}</td>
              <td>
                <strong>{{ item.fullName }}</strong>
              </td>
              <td>{{ item.age }}</td>
              <td>{{ item.parentName }}</td>
              <td>{{ item.parentPhone }}</td>
              <td>{{ item.productPackage?.name || '-' }}</td>
              <td class="attendance-count">
                <span class="badge badge-success">{{ item.totalAttendance }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading() && reportData().length === 0 && !error()" class="no-data">
        Không tìm thấy học sinh phù hợp.
      </div>

      <!-- Image Modal -->
      <div class="modal" *ngIf="modalImage()" (click)="closeImageModal()">
        <div class="modal-content">
          <span class="close">&times;</span>
          <img [src]="modalImage()" alt="Ảnh học sinh" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-container {
      padding:2rem;
      max-width:1600px;
      margin:0 auto;
      color:#e8eef7;
      background:linear-gradient(145deg,#08152b 0%,#0d2344 40%,#0c1d37 100%);
      border-radius:18px;
      box-shadow:0 20px 60px rgba(0,0,0,0.35);
    }

    h1 {
      color:#f5f7fb;
      margin-bottom:1.5rem;
      letter-spacing:0.5px;
    }

    .filters {
      display:flex;
      gap:16px;
      flex-wrap:wrap;
      background:rgba(255,255,255,0.04);
      padding:20px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,0.06);
      box-shadow:0 10px 30px rgba(0,0,0,0.25);
      margin-bottom:24px;
      backdrop-filter:blur(8px);
    }

    .filter-group {
      display:flex;
      flex-direction:column;
      gap:8px;
      flex:1;
      min-width:200px;
      color:#cbd5e1;
    }

    .filter-group label {
      font-weight:700;
      color:#e5eaf1;
      font-size:14px;
      text-transform:uppercase;
      letter-spacing:0.6px;
    }

    .filter-group select,
    .filter-group input {
      padding:12px 14px;
      border:1px solid rgba(255,255,255,0.12);
      border-radius:10px;
      font-size:14px;
      background:rgba(8,25,50,0.9);
      color:#f5f7fb;
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);
      transition:all 0.2s ease;
    }

    .filter-group select:focus,
    .filter-group input:focus {
      outline:none;
      border-color:#5fd1ff;
      box-shadow:0 0 0 3px rgba(95,209,255,0.2);
    }

    .filter-group input::placeholder { color:#9fb3ce; }

    .btn {
      padding:12px 20px;
      border:none;
      border-radius:10px;
      cursor:pointer;
      font-weight:700;
      align-self:flex-end;
      background:linear-gradient(120deg,#38bdf8 0%,#2563eb 100%);
      color:#041022;
      box-shadow:0 10px 25px rgba(56,189,248,0.25);
      transition:transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
    }

    .btn:hover {
      transform:translateY(-1px);
      box-shadow:0 14px 30px rgba(56,189,248,0.3);
      filter:brightness(1.05);
    }

    .loading, .error, .no-data {
      text-align:center;
      padding:36px;
      background:rgba(255,255,255,0.04);
      border-radius:12px;
      margin:20px 0;
      border:1px solid rgba(255,255,255,0.06);
      color:#e8eef7;
    }

    .error { color:#fca5a5; }

    .report-summary {
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));
      gap:20px;
      margin-bottom:24px;
    }

    .summary-card {
      background:linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
      padding:24px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 14px 40px rgba(0,0,0,0.32);
      text-align:center;
    }

    .summary-card h3 {
      font-size:13px;
      color:#b8c3d6;
      margin-bottom:10px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:0.8px;
    }

    .summary-number {
      font-size:40px;
      font-weight:800;
      color:#f5f7fb;
      margin:0;
      text-shadow:0 4px 14px rgba(0,0,0,0.4);
    }

    .report-table-container {
      background:rgba(4,16,34,0.9);
      border-radius:14px;
      box-shadow:0 18px 45px rgba(0,0,0,0.35);
      overflow-x:auto;
      border:1px solid rgba(255,255,255,0.05);
    }

    .report-table {
      width:100%;
      border-collapse:collapse;
      min-width:900px;
    }

    .report-table thead {
      background:linear-gradient(120deg,#0f274d,#103360);
      border-bottom:2px solid rgba(255,255,255,0.08);
    }

    .report-table th {
      padding:16px;
      text-align:left;
      font-weight:700;
      color:#d9e5f7;
      font-size:13px;
      text-transform:uppercase;
      letter-spacing:0.6px;
    }

    .report-table td {
      padding:14px 16px;
      border-bottom:1px solid rgba(255,255,255,0.06);
      color:#e8eef7;
      background:rgba(12,29,55,0.75);
    }

    .report-table tbody tr:nth-child(odd) {
      background:rgba(14,34,63,0.9);
    }

    .report-table tbody tr:hover {
      background:rgba(56,189,248,0.06);
    }

    .image-cell { text-align:center; }

    .student-avatar {
      width:52px;
      height:52px;
      object-fit:cover;
      border-radius:50%;
      cursor:pointer;
      transition:transform 0.2s, box-shadow 0.2s;
      border:2px solid rgba(255,255,255,0.15);
      box-shadow:0 8px 20px rgba(0,0,0,0.35);
    }

    .student-avatar:hover { transform:scale(1.08); }

    .no-image {
      color:#9fb3ce;
      font-size:12px;
      font-style:italic;
    }

    .attendance-count { text-align:center; }

    .badge {
      padding:6px 12px;
      border-radius:12px;
      font-weight:700;
      font-size:13px;
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 6px 18px rgba(0,0,0,0.28);
    }

    .badge-success {
      background:linear-gradient(135deg,#4ade80,#22c55e);
      color:#052814;
    }

    .modal {
      display:flex;
      align-items:center;
      justify-content:center;
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:rgba(0,0,0,0.8);
      z-index:1000;
      cursor:pointer;
    }

    .modal-content {
      position:relative;
      max-width:90%;
      max-height:90%;
    }

    .modal-content img {
      max-width:100%;
      max-height:90vh;
      border-radius:8px;
      box-shadow:0 20px 50px rgba(0,0,0,0.5);
    }

    .close {
      position:absolute;
      top:-40px;
      right:0;
      color:white;
      font-size:40px;
      font-weight:bold;
      cursor:pointer;
    }
  `]
})
export class StudentReportComponent implements OnInit {
  private studentService = inject(StudentService);
  private classService = inject(ClassService);

  reportData = signal<StudentReportEntry[]>([]);
  classes = signal<ClassItem[]>([]);
  loading = signal(false);
  error = signal('');
  modalImage = signal('');

  selectedClassId = '';
  searchTerm = '';

  async ngOnInit() {
    this.loadClasses();
    this.loadReport();
  }

  async loadClasses(): Promise<void> {
    try {
      const classes: ClassItem[] = await this.classService.list();
      this.classes.set(classes);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async loadReport() {
    this.loading.set(true);
    this.error.set('');

    try {
      const data = (await this.studentService.getStudentReport(
        this.selectedClassId || undefined,
        this.searchTerm || undefined
      )) as StudentReportEntry[];

      this.reportData.set(data);
    } catch (error: any) {
      this.error.set(error.message || 'Không thể tải báo cáo');
    } finally {
      this.loading.set(false);
    }
  }

  getTotalAttendance(): number {
    return this.reportData().reduce((sum, item) => sum + item.totalAttendance, 0);
  }

  getImageUrl(imageUrl: string): string {
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    return `${environment.apiBase}${imageUrl}`;
  }

  showImageModal(imageUrl: string) {
    this.modalImage.set(imageUrl);
  }

  closeImageModal() {
    this.modalImage.set('');
  }
}
