import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StudentItem, StudentService } from '../services/student.service';
import { ProductItem, ProductService } from '../services/product.service';
import { AuthService } from '../services/auth.service';

interface StudentForm {
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage: string;
  productPackage: string;
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-header">
      <div>
        <h2>Quản lý học sinh</h2>
        <p>Theo dõi thông tin phụ huynh và ảnh nhận diện.</p>
      </div>
      <button class="primary" (click)="openModal()">+ Thêm học sinh</button>
    </header>

    <section class="filters">
      <input placeholder="Tìm theo tên hoặc mã học sinh" [(ngModel)]="keyword" />
      <button (click)="reload()">Làm mới</button>
    </section>

    <table class="data" *ngIf="filtered().length; else empty">
      <thead>
        <tr>
          <th>Ảnh</th>
          <th>Mã học sinh</th>
          <th>Họ và tên</th>
          <th>Tuổi</th>
          <th>Tên phụ huynh</th>
          <th>Điện thoại</th>
          <th>Gói sản phẩm</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let s of filtered()">
          <td><img [src]="s.faceImage" alt="{{s.fullName}}" /></td>
          <td><strong>{{s.studentCode}}</strong></td>
          <td>{{s.fullName}}</td>
          <td>{{s.age}}</td>
          <td>{{s.parentName}}</td>
          <td>{{s.parentPhone}}</td>
          <td>{{ s.productPackage?.name || '-' }}</td>
          <td class="actions-cell">
            <button class="ghost" (click)="edit(s)">Sửa</button>
            <button class="ghost" (click)="remove(s)" *ngIf="canDeleteStudents">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #empty><p>Chưa có học sinh.</p></ng-template>

    <div class="modal-backdrop" *ngIf="showModal()">
      <div class="modal">
        <h3>{{ editingStudent ? 'Sửa học sinh' : 'Thêm học sinh' }}</h3>
        <form (ngSubmit)="submit()" #f="ngForm">
          <label>Mã học sinh
            <input name="studentCode" [(ngModel)]="form.studentCode" placeholder="Ví dụ: HS001" required />
          </label>
          <label>Họ và tên
            <input name="fullName" [(ngModel)]="form.fullName" required />
          </label>
          <label>Tuổi
            <input name="age" type="number" min="3" max="25" [(ngModel)]="form.age" required />
          </label>
          <label>Tên phụ huynh
            <input name="parentName" [(ngModel)]="form.parentName" required />
          </label>
          <label>Điện thoại phụ huynh
            <input name="parentPhone" [(ngModel)]="form.parentPhone" required />
          </label>
          <label>Ảnh nhận diện
            <input type="file" accept="image/*" (change)="handleFileChange($event)" />
          </label>
          <label>Gói sản phẩm
            <select name="productPackage" [(ngModel)]="form.productPackage">
              <option value="">-- Chọn gói --</option>
              <option *ngFor="let p of products()" [value]="p._id">{{ p.name }}</option>
            </select>
          </label>
          <div class="upload-status">
            <span *ngIf="uploading()">Đang tải ảnh...</span>
            <span class="error" *ngIf="uploadError()">{{uploadError()}}</span>
            <img *ngIf="form.faceImage && !uploading()" [src]="form.faceImage" alt="Xem trước" class="preview" />
          </div>
          <div class="actions">
            <button type="submit" class="primary" [disabled]="uploading() || !form.faceImage">Lưu</button>
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
    input { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; width:100%; }
    select { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; width:100%; background:#fff; }
    .data { width:100%; border-collapse:collapse; background:#fff; }
    th, td { padding:8px; border:1px solid #e2e8f0; vertical-align:middle; }
    thead { background:#f1f5f9; }
    img { width:44px; height:44px; object-fit:cover; border-radius:4px; border:1px solid #cbd5f5; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:6px 10px; border-radius:4px; cursor:pointer; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:360px; box-shadow:0 8px 24px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { width:120px; text-align:right; }
    .actions-cell button { margin-left:4px; }
    .error { color:#dc2626; }
    .upload-status { display:flex; flex-direction:column; gap:6px; font-size:13px; }
    .preview { width:120px; height:120px; object-fit:cover; border-radius:8px; border:1px solid #cbd5f5; }
  `]
})
export class StudentsComponent {
  items = signal<StudentItem[]>([]);
  products = signal<ProductItem[]>([]);
  keyword = '';
  showModal = signal(false);
  error = signal('');
  uploadError = signal('');
  uploading = signal(false);
  form: StudentForm = this.blankForm();
  canDeleteStudents = false;
  editingStudent: StudentItem | null = null;

  constructor(
    private studentService: StudentService,
    private productService: ProductService,
    private auth: AuthService
  ) {
    this.reload();
    this.loadProducts();
    this.canDeleteStudents = this.auth.userSignal()?.role === 'DIRECTOR';
  }

  filtered = computed(() => {
    const kw = this.keyword.trim().toLowerCase();
    if (!kw) return this.items();
    return this.items().filter((s) =>
      s.fullName.toLowerCase().includes(kw) ||
      s.studentCode.toLowerCase().includes(kw)
    );
  });

  async reload() {
    const data = await this.studentService.list();
    this.items.set(data);
  }

  async loadProducts() {
    const data = await this.productService.list();
    this.products.set(data);
  }

  openModal() {
    this.editingStudent = null;
    this.form = this.blankForm();
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  edit(student: StudentItem) {
    this.editingStudent = student;
    this.form = {
      studentCode: student.studentCode || '',
      fullName: student.fullName,
      age: student.age,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      faceImage: student.faceImage,
      productPackage: student.productPackage?._id || '',
    };
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  async submit() {
    const payload: any = {
      studentCode: this.form.studentCode.trim(),
      fullName: this.form.fullName.trim(),
      age: Number(this.form.age),
      parentName: this.form.parentName.trim(),
      parentPhone: this.form.parentPhone.trim(),
      faceImage: this.form.faceImage.trim(),
    };

    if (this.form.productPackage) {
      payload.productPackage = this.form.productPackage;
    }

    let result;
    if (this.editingStudent) {
      result = await this.studentService.update(this.editingStudent._id, payload);
      if (!result.ok) {
        this.error.set(result.message || 'Không thể cập nhật học sinh');
        return;
      }
    } else {
      result = await this.studentService.create(payload);
      if (!result.ok) {
        this.error.set(result.message || 'Không thể tạo học sinh');
        return;
      }
    }

    this.closeModal();
    this.reload();
  }

  async handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set('');
    this.uploading.set(true);
    const result = await this.studentService.uploadFace(file);
    this.uploading.set(false);

    if (!result.ok || !result.url) {
      this.uploadError.set(result.message || 'Tải ảnh thất bại');
      return;
    }

    this.form.faceImage = result.url;
  }

  async remove(student: StudentItem) {
    if (!confirm(`Xóa học sinh ${student.fullName}?`)) return;
    const result = await this.studentService.remove(student._id);
    if (!result.ok) {
      alert(result.message || 'Không thể xóa học sinh');
      return;
    }
    this.reload();
  }

  private blankForm(): StudentForm {
    return {
      studentCode: '',
      fullName: '',
      age: 6,
      parentName: '',
      parentPhone: '',
      faceImage: '',
      productPackage: '',
    };
  }
}
