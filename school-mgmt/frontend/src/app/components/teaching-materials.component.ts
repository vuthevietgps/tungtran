import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeacherService, TeachingMaterial } from '../services/teacher.service';
import { ClassService, ClassItem } from '../services/class.service';
import { environment } from '../../environments/environment';

interface MaterialForm {
  title: string;
  description: string;
  subject: string;
  grade: string;
  classId: string;
  tags: string;
  isShared: boolean;
}

@Component({
  selector: 'app-teaching-materials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="materials-page">
    <header class="page-header">
      <div class="header-left">
        <h2>📂 Tài liệu giảng dạy</h2>
        <p class="subtitle">Quản lý giáo án, bài tập, tài liệu tham khảo</p>
      </div>
      <button class="btn primary" (click)="openUploadModal()">📤 Tải lên tài liệu</button>
    </header>

    <!-- Stats Bar -->
    <div class="stats-bar" *ngIf="stats()">
      <div class="stat-chip">
        <span class="stat-num">{{ stats()!.total }}</span>
        <span class="stat-lbl">Tài liệu</span>
      </div>
      <div class="stat-chip">
        <span class="stat-num">{{ stats()!.totalSizeMB }} MB</span>
        <span class="stat-lbl">Dung lượng</span>
      </div>
      <div class="stat-chip" *ngFor="let entry of objectEntries(stats()!.bySubject)">
        <span class="stat-num">{{ entry[1] }}</span>
        <span class="stat-lbl">{{ entry[0] }}</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="search-box">
        <input type="text" [(ngModel)]="searchQuery" placeholder="🔍 Tìm tài liệu..." (input)="applyFilter()" />
      </div>
      <select [(ngModel)]="filterSubject" (change)="applyFilter()">
        <option value="">Tất cả môn</option>
        <option *ngFor="let s of subjectOptions()" [value]="s">{{ s }}</option>
      </select>
      <select [(ngModel)]="filterGrade" (change)="applyFilter()">
        <option value="">Tất cả khối</option>
        <option *ngFor="let g of gradeOptions()" [value]="g">{{ g }}</option>
      </select>
      <select [(ngModel)]="filterType" (change)="applyFilter()">
        <option value="">Tất cả loại file</option>
        <option value="pdf">PDF</option>
        <option value="doc">Word</option>
        <option value="ppt">PowerPoint</option>
        <option value="excel">Excel</option>
        <option value="image">Hình ảnh</option>
        <option value="video">Video</option>
        <option value="other">Khác</option>
      </select>
    </div>

    <div *ngIf="loading()" class="loading-state">
      <div class="spinner"></div>
      <span>Đang tải...</span>
    </div>

    <div *ngIf="error()" class="alert error">{{ error() }}</div>
    <div *ngIf="successMsg()" class="alert success">{{ successMsg() }}</div>

    <!-- Materials Grid -->
    <div class="materials-grid" *ngIf="!loading()">
      <div *ngIf="filtered().length === 0 && !loading()" class="empty-state">
        <div class="empty-icon">📁</div>
        <p>Chưa có tài liệu nào</p>
        <button class="btn primary small" (click)="openUploadModal()">Tải lên tài liệu đầu tiên</button>
      </div>

      <div class="material-card" *ngFor="let m of filtered()">
        <div class="card-header">
          <div class="file-icon" [attr.data-type]="getFileCategory(m.fileType)">{{ fileIcon(m.fileType) }}</div>
          <div class="card-info">
            <div class="card-title">{{ m.title }}</div>
            <div class="card-meta">{{ m.originalName }}</div>
          </div>
          <div class="card-actions">
            <button class="btn-icon" title="Tải xuống" (click)="downloadFile(m)">⬇️</button>
            <button class="btn-icon" title="Chỉnh sửa" (click)="openEditModal(m)">✏️</button>
            <button class="btn-icon danger" title="Xóa" (click)="confirmDelete(m)">🗑️</button>
          </div>
        </div>

        <p class="card-desc" *ngIf="m.description">{{ m.description }}</p>

        <div class="card-tags">
          <span class="tag blue" *ngIf="m.subject">{{ m.subject }}</span>
          <span class="tag green" *ngIf="m.grade">{{ m.grade }}</span>
          <span class="tag gray" *ngFor="let t of m.tags">{{ t }}</span>
          <span class="tag purple" *ngIf="m.isShared">📤 Chia sẻ</span>
        </div>

        <div class="card-footer">
          <span class="file-size">{{ formatSize(m.fileSize) }}</span>
          <span class="file-date">{{ m.createdAt | date:'dd/MM/yyyy' }}</span>
          <span class="download-count" *ngIf="m.downloadCount > 0">⬇ {{ m.downloadCount }}</span>
        </div>
      </div>
    </div>

    <!-- Upload / Edit Modal -->
    <div class="modal-backdrop" *ngIf="showModal()" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ editingMaterial ? '✏️ Chỉnh sửa tài liệu' : '📤 Tải lên tài liệu mới' }}</h3>
          <button class="btn-close" (click)="closeModal()">✕</button>
        </div>
        <form (ngSubmit)="submitMaterial()" #materialForm="ngForm">
          <div class="modal-body">
            <!-- File upload (chỉ khi tạo mới) -->
            <div class="field" *ngIf="!editingMaterial">
              <label>File tài liệu *</label>
              <div class="file-drop-zone" [class.has-file]="selectedFile"
                   (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
                <div *ngIf="!selectedFile" class="drop-content">
                  <div class="drop-icon">📁</div>
                  <p>Kéo thả file vào đây hoặc</p>
                  <label class="file-browse">
                    Chọn file
                    <input type="file" (change)="onFileSelect($event)" style="display:none"
                           accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.zip,.rar,.7z,.txt,.csv" />
                  </label>
                  <p class="drop-hint">PDF, Word, Excel, PowerPoint, ảnh, video (tối đa 50MB)</p>
                </div>
                <div *ngIf="selectedFile" class="selected-file">
                  <span class="file-icon-lg">{{ fileIcon(selectedFile.type) }}</span>
                  <div class="selected-file-info">
                    <div class="selected-file-name">{{ selectedFile.name }}</div>
                    <div class="selected-file-size">{{ formatSize(selectedFile.size) }}</div>
                  </div>
                  <button type="button" class="btn-icon danger" (click)="removeFile()">✕</button>
                </div>
              </div>
            </div>

            <div class="field">
              <label>Tiêu đề *</label>
              <input name="title" [(ngModel)]="materialForm_data.title" required placeholder="VD: Giáo án Toán lớp 10 - Chương 1" />
            </div>

            <div class="field">
              <label>Mô tả</label>
              <textarea name="description" [(ngModel)]="materialForm_data.description" rows="3"
                        placeholder="Nội dung tóm tắt của tài liệu..."></textarea>
            </div>

            <div class="form-row">
              <div class="field">
                <label>Môn học</label>
                <input name="subject" [(ngModel)]="materialForm_data.subject" placeholder="Toán" list="subjectSuggestions" />
                <datalist id="subjectSuggestions">
                  <option *ngFor="let s of subjectOptions()" [value]="s">
                </datalist>
              </div>
              <div class="field">
                <label>Khối lớp</label>
                <input name="grade" [(ngModel)]="materialForm_data.grade" placeholder="Lớp 10" list="gradeSuggestions" />
                <datalist id="gradeSuggestions">
                  <option *ngFor="let g of gradeOptions()" [value]="g">
                </datalist>
              </div>
            </div>

            <div class="field">
              <label>Lớp học liên quan</label>
              <select name="classId" [(ngModel)]="materialForm_data.classId">
                <option value="">-- Không chọn --</option>
                <option *ngFor="let c of classes()" [value]="c._id">{{ c.name }} ({{ c.code }})</option>
              </select>
            </div>

            <div class="field">
              <label>Tags <small>(phân cách bằng dấu phẩy)</small></label>
              <input name="tags" [(ngModel)]="materialForm_data.tags" placeholder="bài tập, ôn thi, chương 1" />
            </div>

            <div class="field checkbox">
              <label>
                <input type="checkbox" name="isShared" [(ngModel)]="materialForm_data.isShared" />
                Chia sẻ với giáo viên khác
              </label>
            </div>

            <!-- Upload Progress -->
            <div *ngIf="uploading()" class="upload-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: 100%; animation: pulse 1.5s ease-in-out infinite"></div>
              </div>
              <span>Đang {{ editingMaterial ? 'cập nhật' : 'tải lên' }}...</span>
            </div>
          </div>

          <div class="modal-footer">
            <button type="submit" class="btn primary" [disabled]="uploading() || (!editingMaterial && !selectedFile)">
              {{ editingMaterial ? '💾 Lưu thay đổi' : '📤 Tải lên' }}
            </button>
            <button type="button" class="btn secondary" (click)="closeModal()">Hủy</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal-backdrop" *ngIf="showDeleteConfirm()" (click)="showDeleteConfirm.set(false)">
      <div class="modal small" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>⚠️ Xác nhận xóa</h3>
        </div>
        <div class="modal-body">
          <p>Bạn có chắc muốn xóa tài liệu <strong>{{ deletingMaterial?.title }}</strong>?</p>
          <p class="warning-text">Hành động này không thể hoàn tác. File sẽ bị xóa vĩnh viễn.</p>
        </div>
        <div class="modal-footer">
          <button class="btn danger" (click)="executeDelete()" [disabled]="uploading()">Xóa</button>
          <button class="btn secondary" (click)="showDeleteConfirm.set(false)">Hủy</button>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .materials-page { padding: 24px; max-width: 1200px; margin: 0 auto; }

    /* Header */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .header-left h2 { margin: 0 0 4px; color: #1e293b; font-size: 22px; }
    .subtitle { margin: 0; color: #64748b; font-size: 14px; }

    /* Stats Bar */
    .stats-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .stat-chip { background: #fff; border-radius: 10px; padding: 12px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; flex-direction: column; align-items: center; min-width: 80px; }
    .stat-num { font-size: 18px; font-weight: 700; color: #1e293b; }
    .stat-lbl { font-size: 11px; color: #94a3b8; margin-top: 2px; }

    /* Filters */
    .filters { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .search-box { flex: 1; min-width: 200px; }
    .search-box input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; }
    .search-box input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .filters select { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; background: #fff; outline: none; cursor: pointer; min-width: 130px; }

    /* Loading */
    .loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; color: #64748b; }
    .spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }

    /* Alerts */
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .alert.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .alert.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

    /* Empty State */
    .empty-state { text-align: center; padding: 60px 20px; color: #94a3b8; grid-column: 1 / -1; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-state p { margin: 0 0 16px; font-size: 15px; }

    /* Materials Grid */
    .materials-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px; }

    /* Material Card */
    .material-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: box-shadow 0.2s, transform 0.2s; border: 1px solid #f1f5f9; }
    .material-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }
    .card-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
    .file-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .file-icon[data-type="pdf"] { background: #fef2f2; }
    .file-icon[data-type="doc"] { background: #dbeafe; }
    .file-icon[data-type="ppt"] { background: #fef3c7; }
    .file-icon[data-type="excel"] { background: #dcfce7; }
    .file-icon[data-type="image"] { background: #ede9fe; }
    .file-icon[data-type="video"] { background: #fce7f3; }
    .file-icon[data-type="other"] { background: #f1f5f9; }
    .card-info { flex: 1; min-width: 0; }
    .card-title { font-weight: 600; color: #1e293b; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-meta { font-size: 12px; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .card-desc { font-size: 13px; color: #64748b; margin: 0 0 10px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    /* Tags */
    .card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .tag { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 500; }
    .tag.blue { background: #dbeafe; color: #2563eb; }
    .tag.green { background: #dcfce7; color: #16a34a; }
    .tag.gray { background: #f1f5f9; color: #475569; }
    .tag.purple { background: #ede9fe; color: #7c3aed; }

    .card-footer { display: flex; gap: 16px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
    .download-count { color: #3b82f6; font-weight: 500; }

    /* Buttons */
    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn.primary { background: #3b82f6; color: #fff; }
    .btn.primary:hover { background: #2563eb; }
    .btn.primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .btn.secondary { background: #f1f5f9; color: #475569; }
    .btn.secondary:hover { background: #e2e8f0; }
    .btn.danger { background: #ef4444; color: #fff; }
    .btn.danger:hover { background: #dc2626; }
    .btn.small { font-size: 13px; padding: 8px 14px; }
    .btn-icon { width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; background: #f8fafc; transition: all 0.2s; }
    .btn-icon:hover { background: #e2e8f0; }
    .btn-icon.danger { color: #dc2626; }
    .btn-icon.danger:hover { background: #fef2f2; }
    .btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #94a3b8; padding: 4px 8px; }
    .btn-close:hover { color: #475569; }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
    .modal.small { max-width: 420px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 0; }
    .modal-header h3 { margin: 0; font-size: 18px; color: #1e293b; }
    .modal-body { padding: 20px 24px; }
    .modal-footer { display: flex; gap: 10px; padding: 16px 24px; border-top: 1px solid #f1f5f9; }

    /* Form */
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .field label { font-size: 13px; color: #475569; font-weight: 500; }
    .field label small { color: #94a3b8; font-weight: 400; }
    .field input, .field select, .field textarea { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; color: #334155; outline: none; font-family: inherit; transition: border-color 0.2s; }
    .field input:focus, .field select:focus, .field textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field.checkbox { flex-direction: row; gap: 8px; align-items: center; }
    .field.checkbox label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .field.checkbox input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; }

    /* File Drop Zone */
    .file-drop-zone { border: 2px dashed #d1d5db; border-radius: 12px; padding: 30px 20px; text-align: center; transition: all 0.3s; background: #fafafa; cursor: pointer; }
    .file-drop-zone:hover, .file-drop-zone.dragover { border-color: #3b82f6; background: #eff6ff; }
    .file-drop-zone.has-file { border-style: solid; border-color: #22c55e; background: #f0fdf4; padding: 16px 20px; }
    .drop-content { color: #64748b; }
    .drop-icon { font-size: 40px; margin-bottom: 8px; }
    .drop-content p { margin: 4px 0; font-size: 14px; }
    .drop-hint { font-size: 12px; color: #94a3b8 !important; margin-top: 8px !important; }
    .file-browse { display: inline-block; padding: 8px 16px; background: #3b82f6; color: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; margin-top: 4px; }
    .file-browse:hover { background: #2563eb; }
    .selected-file { display: flex; align-items: center; gap: 12px; text-align: left; }
    .file-icon-lg { font-size: 32px; }
    .selected-file-info { flex: 1; }
    .selected-file-name { font-weight: 600; color: #1e293b; font-size: 14px; }
    .selected-file-size { font-size: 12px; color: #64748b; }

    /* Upload Progress */
    .upload-progress { margin-top: 12px; text-align: center; }
    .progress-bar { height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; margin-bottom: 8px; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 2px; }
    .upload-progress span { font-size: 13px; color: #64748b; }

    /* Warning */
    .warning-text { color: #dc2626; font-size: 13px; }

    /* Responsive */
    @media (max-width: 768px) {
      .materials-grid { grid-template-columns: 1fr; }
      .filters { flex-direction: column; }
      .form-row { grid-template-columns: 1fr; }
      .materials-page { padding: 16px; }
    }
  `]
})
export class TeachingMaterialsComponent implements OnInit {
  materials = signal<TeachingMaterial[]>([]);
  stats = signal<any>(null);
  classes = signal<ClassItem[]>([]);
  loading = signal(false);
  error = signal('');
  successMsg = signal('');
  showModal = signal(false);
  showDeleteConfirm = signal(false);
  uploading = signal(false);

  searchQuery = '';
  filterSubject = '';
  filterGrade = '';
  filterType = '';

  selectedFile: File | null = null;
  editingMaterial: TeachingMaterial | null = null;
  deletingMaterial: TeachingMaterial | null = null;

  materialForm_data: MaterialForm = this.blankForm();

  constructor(
    private teacherService: TeacherService,
    private classService: ClassService,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [materials, stats, classes] = await Promise.all([
        this.teacherService.getMaterials(),
        fetch(`${environment.apiBase}/teaching-materials/stats`, { credentials: 'include' }).then(r => r.json()).catch(() => null),
        this.classService.list().catch(() => []),
      ]);
      this.materials.set(materials);
      this.stats.set(stats);
      this.classes.set(classes);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Không thể tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Computed values ──

  subjectOptions = computed(() => {
    const subjects = new Set<string>();
    this.materials().forEach(m => { if (m.subject) subjects.add(m.subject); });
    return [...subjects].sort();
  });

  gradeOptions = computed(() => {
    const grades = new Set<string>();
    this.materials().forEach(m => { if (m.grade) grades.add(m.grade); });
    return [...grades].sort();
  });

  filtered = computed(() => {
    let items = this.materials();
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      items = items.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.originalName.toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (this.filterSubject) items = items.filter(m => m.subject === this.filterSubject);
    if (this.filterGrade) items = items.filter(m => m.grade === this.filterGrade);
    if (this.filterType) items = items.filter(m => this.getFileCategory(m.fileType) === this.filterType);
    return items;
  });

  applyFilter() {
    // Trigger computed re-evaluation by accessing filtered
    this.filtered();
  }

  // ── Modal ──

  openUploadModal() {
    this.editingMaterial = null;
    this.selectedFile = null;
    this.materialForm_data = this.blankForm();
    this.showModal.set(true);
    this.error.set('');
    this.successMsg.set('');
  }

  openEditModal(m: TeachingMaterial) {
    this.editingMaterial = m;
    this.selectedFile = null;
    this.materialForm_data = {
      title: m.title,
      description: m.description || '',
      subject: m.subject || '',
      grade: m.grade || '',
      classId: typeof m.classId === 'object' ? (m.classId as any)?._id || '' : m.classId || '',
      tags: m.tags.join(', '),
      isShared: m.isShared,
    };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingMaterial = null;
    this.selectedFile = null;
  }

  // ── File handling ──

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
      // Auto-fill title from filename if empty
      if (!this.materialForm_data.title) {
        this.materialForm_data.title = this.selectedFile.name.replace(/\.[^/.]+$/, '');
      }
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('dragover');
  }

  onDragLeave(event: DragEvent) {
    (event.currentTarget as HTMLElement).classList.remove('dragover');
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.remove('dragover');
    if (event.dataTransfer?.files?.length) {
      this.selectedFile = event.dataTransfer.files[0];
      if (!this.materialForm_data.title) {
        this.materialForm_data.title = this.selectedFile.name.replace(/\.[^/.]+$/, '');
      }
    }
  }

  removeFile() {
    this.selectedFile = null;
  }

  // ── Submit ──

  async submitMaterial() {
    this.uploading.set(true);
    this.error.set('');
    this.successMsg.set('');

    try {
      if (this.editingMaterial) {
        // Update metadata only
        await this.teacherService.updateMaterial(this.editingMaterial._id, {
          title: this.materialForm_data.title,
          description: this.materialForm_data.description || undefined,
          subject: this.materialForm_data.subject || undefined,
          grade: this.materialForm_data.grade || undefined,
          classId: this.materialForm_data.classId || undefined,
          tags: this.materialForm_data.tags ? this.materialForm_data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          isShared: this.materialForm_data.isShared,
        });
        this.successMsg.set('Cập nhật tài liệu thành công!');
      } else {
        // Upload new
        if (!this.selectedFile) return;
        await this.teacherService.uploadMaterial(this.selectedFile, {
          title: this.materialForm_data.title,
          description: this.materialForm_data.description || undefined,
          subject: this.materialForm_data.subject || undefined,
          grade: this.materialForm_data.grade || undefined,
          classId: this.materialForm_data.classId || undefined,
          tags: this.materialForm_data.tags ? this.materialForm_data.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
          isShared: this.materialForm_data.isShared,
        });
        this.successMsg.set('Tải lên tài liệu thành công!');
      }
      this.closeModal();
      await this.loadData();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Có lỗi xảy ra');
    } finally {
      this.uploading.set(false);
    }
  }

  // ── Delete ──

  confirmDelete(m: TeachingMaterial) {
    this.deletingMaterial = m;
    this.showDeleteConfirm.set(true);
  }

  async executeDelete() {
    if (!this.deletingMaterial) return;
    this.uploading.set(true);
    try {
      await this.teacherService.deleteMaterial(this.deletingMaterial._id);
      this.successMsg.set('Đã xóa tài liệu');
      this.showDeleteConfirm.set(false);
      this.deletingMaterial = null;
      await this.loadData();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Không thể xóa tài liệu');
    } finally {
      this.uploading.set(false);
    }
  }

  // ── Download ──

  downloadFile(m: TeachingMaterial) {
    const url = `${environment.apiBase}${m.fileUrl}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = m.originalName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Track download
    this.teacherService.updateMaterial(m._id, {}).catch(() => {});
    // Actually increment via API
    fetch(`${environment.apiBase}/teaching-materials/${m._id}/download`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
  }

  // ── Helpers ──

  blankForm(): MaterialForm {
    return { title: '', description: '', subject: '', grade: '', classId: '', tags: '', isShared: false };
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  getFileCategory(mimeType: string): string {
    if (!mimeType) return 'other';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('msword')) return 'doc';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'other';
  }

  fileIcon(mimeType: string): string {
    const cat = this.getFileCategory(mimeType);
    const icons: Record<string, string> = {
      pdf: '📄', doc: '📝', ppt: '📊', excel: '📈', image: '🖼️', video: '🎬', other: '📎',
    };
    return icons[cat] || '📎';
  }

  objectEntries(obj: any): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }
}
