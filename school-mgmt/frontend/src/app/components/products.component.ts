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
    <input placeholder="Tìm theo tên hoặc mã" [(ngModel)]="keyword" />
    <button (click)="reload()">Làm mới</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead><tr><th>Mã</th><th>Tên</th></tr></thead>
    <tbody>
      <tr *ngFor="let p of filtered()">
        <td>{{p.code}}</td>
        <td>{{p.name}}</td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Chưa có sản phẩm.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>Thêm sản phẩm</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label>Tên sản phẩm
          <input name="name" [(ngModel)]="form.name" required />
        </label>
        <label>Mã sản phẩm
          <input name="code" [(ngModel)]="form.code" required />
        </label>
        <div class="actions">
          <button type="submit" class="primary">Lưu</button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .filters { display:flex; gap:10px; margin-bottom:16px; }
    input { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; }
    .data { width:100%; border-collapse:collapse; background:#fff; }
    th, td { padding:8px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:320px; box-shadow:0 8px 24px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .error { color:#dc2626; }
  `]
})
export class ProductsComponent {
  items = signal<ProductItem[]>([]);
  keyword = '';
  showModal = signal(false);
  error = signal('');
  form = { name: '', code: '' };

  constructor(private productService: ProductService) {
    this.reload();
  }

  filtered = computed(() => {
    const kw = this.keyword.trim().toLowerCase();
    if (!kw) return this.items();
    return this.items().filter(p =>
      p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw)
    );
  });

  openModal() {
    this.form = { name: '', code: '' };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  async reload() {
    const data = await this.productService.list();
    this.items.set(data);
  }

  async submit() {
    const result = await this.productService.create({ name: this.form.name.trim(), code: this.form.code.trim() });
    if (!result.ok) {
      this.error.set(result.message || 'Không thể tạo sản phẩm');
      return;
    }
    this.closeModal();
    this.reload();
  }
}
