import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StudentItem, StudentService } from '../services/student.service';
import { AuthService } from '../services/auth.service';

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
    <input placeholder="Tìm theo tên" [(ngModel)]="keyword" />
    <button (click)="reload()">Làm mới</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead>
      <tr>
        <th>Ảnh</th>
        <th>Họ và tên</th>
        <th>Tuổi</th>
        <th>Tên phụ huynh</th>
        <th>Điện thoại</th>
        <th *ngIf="canDeleteStudents"></th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let s of filtered()">
        <td><img [src]="s.faceImage" alt="{{s.fullName}}" /></td>
        <td>{{s.fullName}}</td>
        <td>{{s.age}}</td>
        <td>{{s.parentName}}</td>
        <td>{{s.parentPhone}}</td>
        <td class="actions-cell" *ngIf="canDeleteStudents">
          <button class="ghost" (click)="remove(s)">Xóa</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Chưa có học sinh.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>Thêm học sinh</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label>Họ và tên
          <input name="fullName" [(ngModel)]="form.fullName" required />
        </label>
        <label>Tuổi
          <input name="age" type="number" min="3" max="25" [(ngModel)]="form.age" required />
        </label>
        <label>Tên phụ huynh
          <input name="parentName" [(ngModel)]="form.parentName" required />
        </label>
        <label>Số điện thoại phụ huynh
          <input name="parentPhone" [(ngModel)]="form.parentPhone" required />
        </label>
        <label>Ảnh khuôn mặt
          <input name="faceImage" type="file" accept="image/*" (change)="handleFileChange($event)" />
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
    .actions-cell { width:80px; text-align:right; }
    .error { color:#dc2626; }
    .upload-status { display:flex; flex-direction:column; gap:6px; font-size:13px; }
    .preview { width:120px; height:120px; object-fit:cover; border-radius:8px; border:1px solid #cbd5f5; }
  `]
})
export class StudentsComponent {
  items = signal<StudentItem[]>([]);
  keyword = '';
  showModal = signal(false);
  error = signal('');
  uploadError = signal('');
  uploading = signal(false);
  form = this.blankForm();
  canDeleteStudents = false;

  constructor(private studentService: StudentService, private auth: AuthService) {
    this.reload();
    this.canDeleteStudents = this.auth.userSignal()?.role === 'DIRECTOR';
  }

  filtered = computed(() => {
    const kw = this.keyword.trim().toLowerCase();
    if (!kw) return this.items();
    return this.items().filter((s) => s.fullName.toLowerCase().includes(kw));
  });

  async reload() {
    const data = await this.studentService.list();
    this.items.set(data);
  }

  openModal() {
    this.form = this.blankForm();
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  async submit() {
    const payload = {
      fullName: this.form.fullName.trim(),
      age: Number(this.form.age),
      parentName: this.form.parentName.trim(),
      parentPhone: this.form.parentPhone.trim(),
      faceImage: this.form.faceImage.trim(),
    };
    const result = await this.studentService.create(payload);
    if (!result.ok) {
      this.error.set(result.message || 'Không thể tạo học sinh');
      return;
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

  private blankForm() {
    return {
      fullName: '',
      age: 6,
      parentName: '',
      parentPhone: '',
      faceImage: '',
    };
  }
}
