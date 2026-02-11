import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductItem } from '../services/product.service';

const CATEGORY_LABELS: Record<string, string> = {
  MATH: 'Toán', ENGLISH: 'Tiếng Anh', SCIENCE: 'Khoa học', LITERATURE: 'Ngữ văn',
  PHYSICS: 'Vật lý', CHEMISTRY: 'Hóa học', BIOLOGY: 'Sinh học',
  HISTORY: 'Lịch sử', GEOGRAPHY: 'Địa lý', INFORMATICS: 'Tin học',
  MULTI_SUBJECT: 'Đa môn', OTHER: 'Khác'
};

const MODE_LABELS: Record<string, string> = { ONLINE: 'Online', OFFLINE: 'Offline', BOTH: 'Cả hai' };

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý Gói học</h2>
      <p>Tạo và quản lý các gói sản phẩm/khóa học.</p>
    </div>
    <button class="primary" (click)="openModal()">+ Thêm gói học</button>
  </header>

  <section class="filters">
    <input placeholder="Tìm theo tên hoặc mã" [(ngModel)]="keyword" />
    <select [(ngModel)]="filterCategory">
      <option value="">Tất cả môn</option>
      <option *ngFor="let c of categories" [value]="c.value">{{c.label}}</option>
    </select>
    <select [(ngModel)]="filterActive">
      <option value="">Tất cả</option>
      <option value="true">Đang bán</option>
      <option value="false">Ngừng bán</option>
    </select>
    <button (click)="reload()">Làm mới</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead><tr>
      <th>Mã</th><th>Tên gói</th><th>Môn</th><th>Hình thức</th>
      <th>Số buổi</th><th>Giá/buổi</th><th>Tổng giá</th><th>Hoa hồng</th><th>Trạng thái</th><th></th>
    </tr></thead>
    <tbody>
      <tr *ngFor="let p of filtered()" [class.inactive]="p.isActive === false">
        <td><strong>{{p.code}}</strong></td>
        <td>
          {{p.name}}
          <small *ngIf="p.description" class="desc">{{p.description}}</small>
        </td>
        <td>{{catLabel(p.category)}}</td>
        <td>{{modeLabel(p.teachingMode)}}</td>
        <td class="center">{{p.defaultSessions || '-'}}</td>
        <td class="right">{{p.pricePerSession ? (p.pricePerSession | number) + 'đ' : '-'}}</td>
        <td class="right">{{p.suggestedPrice ? (p.suggestedPrice | number) + 'đ' : '-'}}</td>
        <td class="center">{{p.commissionRate ? p.commissionRate + '%' : '-'}}</td>
        <td>
          <span class="badge" [class.active]="p.isActive !== false" [class.off]="p.isActive === false">
            {{p.isActive !== false ? 'Đang bán' : 'Ngừng'}}
          </span>
        </td>
        <td>
          <button class="btn-sm" (click)="openEdit(p)">Sửa</button>
          <button class="btn-sm danger" (click)="remove(p)">Xóa</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p class="empty-text">Chưa có gói học nào.</p></ng-template>

  <!-- Modal Create/Edit -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal wide">
      <h3>{{editingId ? 'Sửa gói học' : 'Thêm gói học'}}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <div class="form-grid">
          <label>Tên gói <span class="req">*</span>
            <input name="name" [(ngModel)]="form.name" required />
          </label>
          <label>Mã gói <span class="req">*</span>
            <input name="code" [(ngModel)]="form.code" required [disabled]="!!editingId" />
          </label>
          <label>Môn học
            <select name="category" [(ngModel)]="form.category">
              <option *ngFor="let c of categories" [value]="c.value">{{c.label}}</option>
            </select>
          </label>
          <label>Hình thức
            <select name="teachingMode" [(ngModel)]="form.teachingMode">
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="BOTH">Cả hai</option>
            </select>
          </label>
          <label>Số buổi mặc định
            <input name="defaultSessions" type="number" [(ngModel)]="form.defaultSessions" min="1" />
          </label>
          <label>Thời lượng/buổi (phút)
            <input name="defaultSessionDuration" type="number" [(ngModel)]="form.defaultSessionDuration" min="15" />
          </label>
          <label>Giá/buổi (đ)
            <input name="pricePerSession" type="number" [(ngModel)]="form.pricePerSession" min="0" />
          </label>
          <label>Giá gợi ý toàn gói (đ)
            <input name="suggestedPrice" type="number" [(ngModel)]="form.suggestedPrice" min="0" />
          </label>
          <label>% Hoa hồng Sale
            <input name="commissionRate" type="number" [(ngModel)]="form.commissionRate" min="0" max="100" />
          </label>
          <label>Lớp (VD: 10, 11-12)
            <input name="gradeLevel" [(ngModel)]="form.gradeLevel" />
          </label>
        </div>
        <label class="full">Mô tả
          <textarea name="description" [(ngModel)]="form.description" rows="2"></textarea>
        </label>
        <label class="full">Điểm nổi bật (mỗi dòng 1 điểm)
          <textarea name="highlights" [(ngModel)]="highlightsText" rows="2"></textarea>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="isActive" [(ngModel)]="form.isActive" /> Đang bán
        </label>
        <div class="actions">
          <button type="submit" class="primary">{{editingId ? 'Cập nhật' : 'Lưu'}}</button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding:16px; }
    .filters { display:flex; gap:10px; margin-bottom:16px; padding:0 16px; flex-wrap:wrap; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    textarea { width:100%; resize:vertical; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .center { text-align:center; }
    .right { text-align:right; }
    .inactive { opacity:0.55; }
    .desc { display:block; color:#64748b; font-size:11px; margin-top:2px; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; }
    .badge.active { background:#dcfce7; color:#166534; }
    .badge.off { background:#fee2e2; color:#991b1b; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .btn-sm { padding:4px 10px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; margin-right:4px; }
    .btn-sm.danger { color:#dc2626; border-color:#fca5a5; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; max-width:640px; width:95%; box-shadow:0 8px 24px rgba(15,23,42,.2); max-height:90vh; overflow-y:auto; }
    .modal.wide { max-width:640px; }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-grid label, .full { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; }
    .full { width:100%; }
    .req { color:#dc2626; }
    .checkbox-label { display:flex; align-items:center; gap:6px; font-size:13px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .error { color:#dc2626; font-size:13px; }
    .empty-text { padding:16px; color:#64748b; }
  `]
})
export class ProductsComponent {
  items = signal<ProductItem[]>([]);
  keyword = '';
  filterCategory = '';
  filterActive = '';
  showModal = signal(false);
  error = signal('');
  editingId: string | null = null;
  highlightsText = '';
  form: any = this.emptyForm();

  categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

  constructor(private productService: ProductService) { this.reload(); }

  catLabel(v?: string) { return v ? (CATEGORY_LABELS[v] || v) : '-'; }
  modeLabel(v?: string) { return v ? (MODE_LABELS[v] || v) : '-'; }

  emptyForm() {
    return { name: '', code: '', description: '', category: 'OTHER', teachingMode: 'BOTH',
      defaultSessions: 24, defaultSessionDuration: 90, pricePerSession: 0, suggestedPrice: 0,
      commissionRate: 0, gradeLevel: '', isActive: true };
  }

  filtered = computed(() => {
    let list = this.items();
    const kw = this.keyword.trim().toLowerCase();
    if (kw) list = list.filter(p => p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw));
    if (this.filterCategory) list = list.filter(p => p.category === this.filterCategory);
    if (this.filterActive === 'true') list = list.filter(p => p.isActive !== false);
    if (this.filterActive === 'false') list = list.filter(p => p.isActive === false);
    return list;
  });

  openModal() {
    this.editingId = null;
    this.form = this.emptyForm();
    this.highlightsText = '';
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(p: ProductItem) {
    this.editingId = p._id;
    this.form = { ...p };
    this.highlightsText = (p.highlights || []).join('\n');
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.editingId = null; }

  async reload() {
    const data = await this.productService.list();
    this.items.set(data);
  }

  async submit() {
    const payload: any = { ...this.form };
    payload.highlights = this.highlightsText.split('\n').map((s: string) => s.trim()).filter(Boolean);

    if (this.editingId) {
      delete payload.code; // code is immutable
      const result = await this.productService.update(this.editingId, payload);
      if (!result.ok) { this.error.set(result.message || 'Lỗi'); return; }
    } else {
      const result = await this.productService.create(payload);
      if (!result.ok) { this.error.set(result.message || 'Lỗi'); return; }
    }
    this.closeModal();
    this.reload();
  }

  async remove(p: ProductItem) {
    if (!confirm(`Xóa gói "${p.name}"?`)) return;
    await this.productService.remove(p._id);
    this.reload();
  }
}
