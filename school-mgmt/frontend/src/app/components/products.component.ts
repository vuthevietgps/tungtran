import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductItem } from '../services/product.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý Sản phẩm</h2>
      <p>Thêm mới và theo dõi danh sách sản phẩm.</p>
    </div>
    <button class="primary" (click)="openModal()">+ Thêm sản phẩm</button>
  </header>

  <section class="filters">
    <input placeholder="Tìm theo tên sản phẩm" [(ngModel)]="keyword" />
    <button (click)="reload()">Làm mới</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead><tr><th>Tên</th><th>Loại</th><th>Thầy</th><th>Số buổi</th><th>Hành động</th></tr></thead>
    <tbody>
      <tr *ngFor="let p of filtered()">
        <td>{{p.name}}</td>
        <td>{{p.productType === 'ONLINE' ? 'Online' : 'Offline'}}</td>
        <td>{{p.teacherName || '-'}}</td>
        <td>{{p.sessionCount || '-'}}</td>
        <td class="actions-col">
          <button class="link" (click)="openModal(p)">Sửa</button>
          <button class="link danger" (click)="remove(p)">Xóa</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Chưa có sản phẩm.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingId ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm' }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label>Loại sản phẩm
          <select name="productType" [(ngModel)]="form.productType" required>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </label>
        <label>Thầy (không bắt buộc)
          <input name="teacherName" [(ngModel)]="form.teacherName" />
        </label>
        <label>Nội dung (không bắt buộc)
          <textarea name="content" [(ngModel)]="form.content"></textarea>
        </label>
        <label>Thời gian (không bắt buộc)
          <input name="duration" [(ngModel)]="form.duration" />
        </label>
        <label>Số buổi (không bắt buộc)
          <input name="sessionCount" [(ngModel)]="form.sessionCount" />
        </label>
        <p class="muted">Tên sẽ tự động tạo: <strong>{{ namePreview() || '...' }}</strong></p>
        <div class="actions">
          <button type="submit" class="primary">{{ editingId ? 'Cập nhật' : 'Lưu' }}</button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; color:var(--text); }
    .filters { display:flex; gap:10px; margin-bottom:16px; }
    input, textarea, select { padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:var(--panel); color:var(--text); }
    textarea { min-height:80px; }
    .data { width:100%; border-collapse:collapse; background:var(--surface); color:var(--text); }
    th, td { padding:8px; border:1px solid var(--border); }
    thead { background:#132544; color:var(--muted); }
    .primary { background:var(--primary); color:#04121a; border:1px solid var(--primary-strong); padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:600; }
    .link { background:none; border:none; color:var(--primary); cursor:pointer; padding:0 6px; }
    .link.danger { color:var(--danger); }
    .modal-backdrop { position:fixed; inset:0; background:rgba(4,12,30,.75); display:flex; align-items:center; justify-content:center; }
    .modal { background:var(--surface); padding:20px; border-radius:12px; width:320px; box-shadow:0 20px 50px rgba(0,0,0,0.55); border:1px solid var(--border); color:var(--text); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-col { white-space:nowrap; }
    .error { color:var(--danger); }
    .muted { color:var(--muted); margin:0; }
  `]
})
export class ProductsComponent {
  items = signal<ProductItem[]>([]);
  keyword = '';
  showModal = signal(false);
  error = signal('');
  editingId: string | null = null;
  form = { productType: 'ONLINE' as 'ONLINE' | 'OFFLINE', teacherName: '', content: '', duration: '', sessionCount: '' };

  constructor(private productService: ProductService) {
    this.reload();
  }

  filtered = computed(() => {
    const kw = this.keyword.trim().toLowerCase();
    if (!kw) return this.items();
    return this.items().filter(p => p.name.toLowerCase().includes(kw));
  });

  namePreview = computed(() => {
    const parts = [this.form.teacherName, this.form.content, this.form.duration, this.form.sessionCount]
      .map((p) => p?.toString().trim())
      .filter(Boolean) as string[];
    return parts.join(' - ');
  });

  openModal(product?: ProductItem) {
    if (product) {
      this.editingId = product._id;
      this.form = {
        productType: product.productType,
        teacherName: product.teacherName || '',
        content: product.content || '',
        duration: product.duration || '',
        sessionCount: product.sessionCount || '',
      };
    } else {
      this.editingId = null;
      this.form = { productType: 'ONLINE', teacherName: '', content: '', duration: '', sessionCount: '' };
    }
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  async reload() {
    const data = await this.productService.list();
    this.items.set(data);
  }

  async submit() {
    const payload = {
      productType: this.form.productType,
      teacherName: this.form.teacherName?.trim() || undefined,
      content: this.form.content?.trim() || undefined,
      duration: this.form.duration?.trim() || undefined,
      sessionCount: this.form.sessionCount?.toString().trim() || undefined,
    };

    let result: { ok: boolean; message?: string };
    if (this.editingId) {
      result = await this.productService.update(this.editingId, payload);
    } else {
      result = await this.productService.create(payload);
    }

    if (!result.ok) {
      this.error.set(result.message || 'Không thể lưu sản phẩm');
      return;
    }
    this.closeModal();
    this.reload();
  }

  async remove(product: ProductItem) {
    const confirmed = confirm(`Xóa sản phẩm "${product.name}"?`);
    if (!confirmed) return;
    const ok = await this.productService.remove(product._id);
    if (!ok) {
      this.error.set('Không thể xóa sản phẩm');
      return;
    }
    this.reload();
  }
}
