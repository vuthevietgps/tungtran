import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TeacherService, TeacherProfile, TeacherFullProfile } from '../services/teacher.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-teacher-profiles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="profiles-page">
    <!-- LIST VIEW -->
    <div *ngIf="!selectedId">
      <div class="header">
        <h2>Hồ sơ giáo viên</h2>
        <div class="controls">
          <input type="text" [(ngModel)]="searchText" (input)="filterTeachers()" placeholder="Tìm kiếm..." class="search-input" />
          <select [(ngModel)]="statusFilter" (change)="filterTeachers()">
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="SUSPENDED">Tạm ngưng</option>
            <option value="INACTIVE">Không hoạt động</option>
          </select>
        </div>
      </div>

      <div *ngIf="loading()" class="loading">Đang tải danh sách giáo viên...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <div *ngIf="filteredList.length > 0" class="teachers-grid">
        <div *ngFor="let t of filteredList" class="teacher-card" (click)="openProfile(t._id)">
          <div class="tc-header">
            <div class="tc-avatar">{{ getInitials(t) }}</div>
            <div class="tc-info">
              <h4>{{ getUserName(t) }}</h4>
              <span class="tc-email">{{ getUserEmail(t) }}</span>
            </div>
            <span class="badge" [attr.data-status]="t.status">{{ statusLabel(t.status) }}</span>
          </div>
          <div class="tc-tags" *ngIf="t.subjects?.length">
            <span class="tag" *ngFor="let s of t.subjects">{{ s }}</span>
          </div>
          <div class="tc-stats">
            <div class="tc-stat">
              <span class="tc-stat-val">{{ t.totalSessions || 0 }}</span>
              <span class="tc-stat-lbl">Buổi dạy</span>
            </div>
            <div class="tc-stat">
              <span class="tc-stat-val">{{ t.activeClasses || 0 }}</span>
              <span class="tc-stat-lbl">Lớp đang dạy</span>
            </div>
            <div class="tc-stat">
              <span class="tc-stat-val">{{ t.rating || 'N/A' }}</span>
              <span class="tc-stat-lbl">Đánh giá</span>
            </div>
            <div class="tc-stat">
              <span class="tc-stat-val">{{ t.yearsOfExperience || 0 }}</span>
              <span class="tc-stat-lbl">Năm KN</span>
            </div>
          </div>
          <div class="tc-footer">
            <span>{{ teachingModeLabel(t.teachingMode) }}</span>
            <span>{{ t.pricePerSession | number:'1.0-0' }}đ/buổi</span>
          </div>
        </div>
      </div>

      <div *ngIf="filteredList.length === 0 && !loading()" class="empty">
        Không tìm thấy giáo viên nào
      </div>
    </div>

    <!-- DETAIL VIEW -->
    <div *ngIf="selectedId">
      <div class="detail-header">
        <button class="back-btn" (click)="closeProfile()">&larr; Quay lại</button>
        <h2>Chi tiết hồ sơ giáo viên</h2>
      </div>

      <div *ngIf="detailLoading()" class="loading">Đang tải hồ sơ...</div>
      <div *ngIf="detailError()" class="error">{{ detailError() }}</div>

      <div *ngIf="fullProfile()" class="profile-content">
        <!-- Top Stats -->
        <div class="stats-strip">
          <div class="stat-card accent-blue">
            <div class="stat-icon">📚</div>
            <div class="stat-info">
              <div class="stat-value">{{ fullProfile()!.sessions.totalCount }}</div>
              <div class="stat-label">Tổng buổi dạy</div>
            </div>
          </div>
          <div class="stat-card accent-green">
            <div class="stat-icon">💰</div>
            <div class="stat-info">
              <div class="stat-value">{{ fullProfile()!.payroll.totalPaid | number:'1.0-0' }}đ</div>
              <div class="stat-label">Tổng thu nhập</div>
            </div>
          </div>
          <div class="stat-card accent-purple">
            <div class="stat-icon">🏫</div>
            <div class="stat-info">
              <div class="stat-value">{{ fullProfile()!.classes.totalActive }}</div>
              <div class="stat-label">Lớp đang dạy</div>
            </div>
          </div>
          <div class="stat-card accent-orange">
            <div class="stat-icon">⭐</div>
            <div class="stat-info">
              <div class="stat-value">{{ profileData()!.rating || 'N/A' }}</div>
              <div class="stat-label">Đánh giá ({{ profileData()!.totalReviews }} lượt)</div>
            </div>
          </div>
        </div>

        <div class="content-grid">
          <!-- Personal Info -->
          <div class="section-card">
            <div class="section-header"><h3>👤 Thông tin cá nhân</h3></div>
            <div class="info-grid">
              <div class="info-item">
                <label>Họ tên</label>
                <span>{{ getProfileUserName(fullProfile()!.profile) }}</span>
              </div>
              <div class="info-item">
                <label>Email</label>
                <span>{{ getProfileUserEmail(fullProfile()!.profile) }}</span>
              </div>
              <div class="info-item">
                <label>Số điện thoại</label>
                <span>{{ getProfileUserPhone(fullProfile()!.profile) || 'Chưa cập nhật' }}</span>
              </div>
              <div class="info-item">
                <label>Trạng thái</label>
                <span class="badge" [attr.data-status]="profileData()!.status">{{ statusLabel(profileData()!.status) }}</span>
              </div>
              <div class="info-item">
                <label>Kinh nghiệm</label>
                <span>{{ profileData()!.yearsOfExperience }} năm</span>
              </div>
              <div class="info-item">
                <label>Hình thức</label>
                <span>{{ teachingModeLabel(profileData()!.teachingMode) }}</span>
              </div>
            </div>
            <div class="info-item full" *ngIf="profileData()!.bio">
              <label>Giới thiệu</label>
              <p class="bio-text">{{ profileData()!.bio }}</p>
            </div>
          </div>

          <!-- Teaching Info -->
          <div class="section-card">
            <div class="section-header"><h3>📖 Thông tin giảng dạy</h3></div>
            <div class="info-grid">
              <div class="info-item">
                <label>Môn dạy</label>
                <div class="tag-list">
                  <span class="tag blue" *ngFor="let s of profileData()!.subjects">{{ s }}</span>
                </div>
              </div>
              <div class="info-item">
                <label>Khối lớp</label>
                <div class="tag-list">
                  <span class="tag green" *ngFor="let g of profileData()!.grades">{{ g }}</span>
                </div>
              </div>
              <div class="info-item">
                <label>Khu vực</label>
                <div class="tag-list">
                  <span class="tag gray" *ngFor="let l of profileData()!.locations">{{ l }}</span>
                  <span *ngIf="!profileData()!.locations?.length" class="empty-text">Chưa cập nhật</span>
                </div>
              </div>
            </div>
            <div class="pricing-row">
              <div class="price-box">
                <label>Giá/buổi</label>
                <span class="price">{{ profileData()!.pricePerSession | number:'1.0-0' }}đ</span>
              </div>
              <div class="price-box" *ngIf="profileData()!.pricePerHour">
                <label>Giá/giờ</label>
                <span class="price">{{ profileData()!.pricePerHour | number:'1.0-0' }}đ</span>
              </div>
            </div>
          </div>

          <!-- Qualifications -->
          <div class="section-card" *ngIf="profileData()!.qualifications?.length">
            <div class="section-header"><h3>🎓 Bằng cấp & Chứng chỉ</h3></div>
            <div class="qualification-list">
              <div class="qualification-card" *ngFor="let q of profileData()!.qualifications">
                <div class="qual-icon">🏅</div>
                <div class="qual-info">
                  <div class="qual-title">{{ q.title }}</div>
                  <div class="qual-meta" *ngIf="q.institution">{{ q.institution }}</div>
                  <div class="qual-meta" *ngIf="q.year">Năm: {{ q.year }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Availability -->
          <div class="section-card" *ngIf="profileData()!.availability?.length">
            <div class="section-header"><h3>🕐 Lịch rảnh</h3></div>
            <div class="schedule-grid">
              <div class="schedule-item" *ngFor="let a of profileData()!.availability">
                <span class="day-badge">{{ dayLabel(a.day) }}</span>
                <span class="time-range">{{ a.startTime }} - {{ a.endTime }}</span>
              </div>
            </div>
          </div>

          <!-- Bank Info (readonly for director) -->
          <div class="section-card" *ngIf="profileData()!.bankInfo">
            <div class="section-header"><h3>🏦 Thông tin ngân hàng</h3></div>
            <div class="info-grid">
              <div class="info-item"><label>Ngân hàng</label><span>{{ profileData()!.bankInfo!.bankName }}</span></div>
              <div class="info-item"><label>Số TK</label><span>{{ profileData()!.bankInfo!.accountNumber }}</span></div>
              <div class="info-item"><label>Chủ TK</label><span>{{ profileData()!.bankInfo!.accountHolderName }}</span></div>
              <div class="info-item" *ngIf="profileData()!.bankInfo!.branch"><label>Chi nhánh</label><span>{{ profileData()!.bankInfo!.branch }}</span></div>
            </div>
          </div>

          <!-- Active Classes -->
          <div class="section-card wide" *ngIf="fullProfile()!.classes.active.length">
            <div class="section-header"><h3>🏫 Lớp đang dạy ({{ fullProfile()!.classes.totalActive }})</h3></div>
            <table class="data-table">
              <thead><tr><th>Tên lớp</th><th>Mã lớp</th><th>Số HS</th><th>Giá/buổi</th><th>Lương GV/buổi</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of fullProfile()!.classes.active">
                  <td><strong>{{ c.name }}</strong></td>
                  <td>{{ c.code }}</td>
                  <td>{{ c.students?.length || 0 }}</td>
                  <td>{{ c.pricePerSession | number:'1.0-0' }}đ</td>
                  <td>{{ c.teacherPayPerSession | number:'1.0-0' }}đ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Session Stats -->
          <div class="section-card" *ngIf="fullProfile()!.sessions.totalCount">
            <div class="section-header"><h3>📊 Thống kê buổi học</h3></div>
            <div class="session-stats">
              <div *ngFor="let item of objectEntries(fullProfile()!.sessions.byStatus)" class="session-stat-row">
                <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
                <span class="stat-count">{{ item[1].count }} buổi</span>
                <span class="stat-amount">{{ item[1].totalPayout | number:'1.0-0' }}đ</span>
              </div>
            </div>
          </div>

          <!-- Recent Sessions -->
          <div class="section-card wide" *ngIf="fullProfile()!.sessions.recent.length">
            <div class="section-header"><h3>📋 Buổi dạy gần đây</h3></div>
            <table class="data-table">
              <thead><tr><th>Ngày</th><th>Lớp</th><th>Học sinh</th><th>Trạng thái</th><th>Lương</th></tr></thead>
              <tbody>
                <tr *ngFor="let s of fullProfile()!.sessions.recent">
                  <td>{{ s.scheduledDate | date:'dd/MM/yyyy' }}</td>
                  <td>{{ s.classId?.name || 'N/A' }}</td>
                  <td>{{ s.studentId?.fullName || 'N/A' }}</td>
                  <td><span class="badge" [attr.data-status]="s.status">{{ s.status }}</span></td>
                  <td>{{ s.teacherPayout | number:'1.0-0' }}đ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Approval Info -->
          <div class="section-card" *ngIf="profileData()!.approvedBy">
            <div class="section-header"><h3>✅ Thông tin phê duyệt</h3></div>
            <div class="info-grid">
              <div class="info-item"><label>Người duyệt</label><span>{{ profileData()!.approvedBy?.fullName || 'N/A' }}</span></div>
              <div class="info-item"><label>Ngày duyệt</label><span>{{ profileData()!.approvedAt | date:'dd/MM/yyyy HH:mm' }}</span></div>
              <div class="info-item full" *ngIf="profileData()!.adminNotes"><label>Ghi chú</label><span>{{ profileData()!.adminNotes }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .profiles-page { padding: 24px; max-width: 1200px; margin: 0 auto; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .header h2 { margin: 0; color: #1e293b; font-size: 20px; }
    .controls { display: flex; gap: 8px; }
    .search-input { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; min-width: 200px; }
    .controls select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }

    .loading { text-align: center; padding: 40px; color: #64748b; }
    .error { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .empty { text-align: center; padding: 60px; color: #94a3b8; font-size: 16px; }

    /* Teacher Grid */
    .teachers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .teacher-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
    .teacher-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-color: #bfdbfe; }
    .tc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .tc-avatar { width: 42px; height: 42px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; }
    .tc-info { flex: 1; min-width: 0; }
    .tc-info h4 { margin: 0; font-size: 15px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tc-email { font-size: 12px; color: #94a3b8; }
    .tc-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
    .tag { padding: 2px 8px; border-radius: 99px; font-size: 11px; background: #dbeafe; color: #2563eb; }
    .tag.blue { background: #dbeafe; color: #2563eb; }
    .tag.green { background: #dcfce7; color: #16a34a; }
    .tag.gray { background: #f1f5f9; color: #475569; }
    .tc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
    .tc-stat { text-align: center; }
    .tc-stat-val { display: block; font-weight: 700; font-size: 16px; color: #1e293b; }
    .tc-stat-lbl { font-size: 10px; color: #94a3b8; }
    .tc-footer { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; padding-top: 10px; border-top: 1px solid #f1f5f9; }

    /* Detail */
    .detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .detail-header h2 { margin: 0; color: #1e293b; font-size: 20px; }
    .back-btn { padding: 8px 16px; border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .back-btn:hover { background: #f1f5f9; }

    /* Stats Strip */
    .stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 4px solid; }
    .stat-card.accent-blue { border-color: #3b82f6; }
    .stat-card.accent-green { border-color: #22c55e; }
    .stat-card.accent-purple { border-color: #8b5cf6; }
    .stat-card.accent-orange { border-color: #f97316; }
    .stat-icon { font-size: 28px; }
    .stat-value { font-size: 22px; font-weight: 700; color: #1e293b; }
    .stat-label { font-size: 12px; color: #94a3b8; margin-top: 2px; }

    /* Content Grid */
    .content-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .section-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .section-card.wide { grid-column: span 2; }
    .section-header { margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
    .section-header h3 { margin: 0; font-size: 16px; color: #334155; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item { display: flex; flex-direction: column; gap: 4px; }
    .info-item.full { grid-column: span 2; margin-top: 12px; }
    .info-item label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .info-item span { font-size: 14px; color: #334155; }
    .bio-text { font-size: 14px; color: #475569; line-height: 1.6; margin: 0; white-space: pre-line; }
    .empty-text { color: #cbd5e1; font-style: italic; font-size: 13px; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .pricing-row { display: flex; gap: 24px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
    .price-box { display: flex; flex-direction: column; gap: 4px; }
    .price-box label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .price { font-size: 20px; font-weight: 700; color: #059669; }
    .qualification-list { display: flex; flex-direction: column; gap: 12px; }
    .qualification-card { display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; }
    .qual-icon { font-size: 24px; }
    .qual-title { font-weight: 600; color: #334155; font-size: 14px; }
    .qual-meta { font-size: 13px; color: #64748b; }
    .schedule-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .schedule-item { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd; }
    .day-badge { font-weight: 600; color: #0369a1; font-size: 13px; min-width: 60px; }
    .time-range { color: #475569; font-size: 13px; font-family: monospace; }
    .session-stats { display: flex; flex-direction: column; gap: 8px; }
    .session-stat-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .stat-count { font-weight: 600; color: #334155; min-width: 80px; }
    .stat-amount { color: #059669; font-weight: 500; margin-left: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .data-table tr:hover { background: #f8fafc; }

    .badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; background: #e2e8f0; color: #475569; font-weight: 600; display: inline-block; }
    .badge[data-status="ACTIVE"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="PENDING"] { background: #fef9c3; color: #ca8a04; }
    .badge[data-status="APPROVED"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="SUSPENDED"] { background: #fef2f2; color: #dc2626; }
    .badge[data-status="INACTIVE"] { background: #f1f5f9; color: #64748b; }
    .badge[data-status="FINALIZED"], .badge[data-status="PAID"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="SCHEDULED"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="CANCELLED"] { background: #fef2f2; color: #dc2626; }

    @media (max-width: 900px) {
      .stats-strip { grid-template-columns: repeat(2, 1fr); }
      .content-grid { grid-template-columns: 1fr; }
      .section-card.wide { grid-column: span 1; }
      .teachers-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .stats-strip { grid-template-columns: 1fr; }
      .profiles-page { padding: 16px; }
    }
  `]
})
export class TeacherProfilesComponent implements OnInit {
  allTeachers: any[] = [];
  filteredList: any[] = [];
  loading = signal(false);
  error = signal('');
  searchText = '';
  statusFilter = 'ALL';

  selectedId: string | null = null;
  fullProfile = signal<TeacherFullProfile | null>(null);
  detailLoading = signal(false);
  detailError = signal('');

  constructor(
    private teacherService: TeacherService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    // Check if route has an id param
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.selectedId = id;
        this.loadFullProfile(id);
      }
    });
    this.loadTeachers();
  }

  async loadTeachers() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.allTeachers = await this.teacherService.getAllTeachers();
      this.filterTeachers();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải danh sách giáo viên');
    } finally {
      this.loading.set(false);
    }
  }

  filterTeachers() {
    let list = [...this.allTeachers];
    if (this.statusFilter !== 'ALL') {
      list = list.filter(t => t.status === this.statusFilter);
    }
    if (this.searchText.trim()) {
      const search = this.searchText.toLowerCase().trim();
      list = list.filter(t => {
        const name = this.getUserName(t).toLowerCase();
        const email = this.getUserEmail(t).toLowerCase();
        const subjects = (t.subjects || []).join(',').toLowerCase();
        return name.includes(search) || email.includes(search) || subjects.includes(search);
      });
    }
    this.filteredList = list;
  }

  async openProfile(id: string) {
    this.selectedId = id;
    await this.loadFullProfile(id);
  }

  closeProfile() {
    this.selectedId = null;
    this.fullProfile.set(null);
    this.detailError.set('');
  }

  async loadFullProfile(id: string) {
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      const fp = await this.teacherService.getFullProfile(id);
      this.fullProfile.set(fp);
    } catch (e: any) {
      this.detailError.set(e?.error?.message || 'Lỗi tải hồ sơ chi tiết');
    } finally {
      this.detailLoading.set(false);
    }
  }

  profileData(): any {
    return this.fullProfile()?.profile;
  }

  getUserName(t: any): string {
    if (typeof t.userId === 'object' && t.userId?.fullName) return t.userId.fullName;
    return 'N/A';
  }

  getUserEmail(t: any): string {
    if (typeof t.userId === 'object' && t.userId?.email) return t.userId.email;
    return '';
  }

  getProfileUserName(profile: any): string {
    if (typeof profile.userId === 'object' && profile.userId?.fullName) return profile.userId.fullName;
    return 'N/A';
  }

  getProfileUserEmail(profile: any): string {
    if (typeof profile.userId === 'object' && profile.userId?.email) return profile.userId.email;
    return '';
  }

  getProfileUserPhone(profile: any): string {
    if (typeof profile.userId === 'object' && (profile.userId as any)?.phone) return (profile.userId as any).phone;
    return '';
  }

  getInitials(t: any): string {
    const name = this.getUserName(t);
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  statusLabel(s: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', ACTIVE: 'Đang hoạt động',
      SUSPENDED: 'Tạm ngưng', INACTIVE: 'Không hoạt động',
    };
    return labels[s] || s;
  }

  teachingModeLabel(m: string): string {
    const labels: Record<string, string> = { ONLINE: 'Online', OFFLINE: 'Offline', BOTH: 'Cả hai' };
    return labels[m] || m;
  }

  dayLabel(d: string): string {
    const labels: Record<string, string> = {
      MONDAY: 'T2', TUESDAY: 'T3', WEDNESDAY: 'T4', THURSDAY: 'T5',
      FRIDAY: 'T6', SATURDAY: 'T7', SUNDAY: 'CN',
    };
    return labels[d] || d;
  }

  objectEntries(obj: any): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }
}
