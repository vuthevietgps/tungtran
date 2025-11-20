import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserItem } from '../services/user.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý User</h2>
      <p>Thêm mới, lọc và tìm kiếm tài khoản trong hệ thống</p>
    </div>
    <button class="primary" (click)="openModal()">+ Thêm mới</button>
  </header>

  <section class="filters">
    <input placeholder="Tìm theo email hoặc tên" [(ngModel)]="search" />
    <select [(ngModel)]="roleFilter">
      <option value="">Tất cả role</option>
      <option *ngFor="let r of roleOptions" [value]="r.value">{{r.label}}</option>
    </select>
    <button (click)="reload()">Làm mới</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead>
      <tr><th>Email</th><th>Họ tên</th><th>Role</th><th>Trạng thái</th><th>Hành động</th></tr>
    </thead>
    <tbody>
      <tr *ngFor="let u of filtered()">
        <td>{{u.email}}</td>
        <td>{{u.fullName}}</td>
        <td>{{translateRole(u.role)}}</td>
        <td>{{u.status || 'N/A'}}</td>
        <td class="actions-cell">
          <button class="ghost" (click)="edit(u)" [disabled]="isSelf(u)">Sửa</button>
          <button class="danger" (click)="remove(u)" [disabled]="isSelf(u)">Xóa</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Không có dữ liệu hoặc không trùng bộ lọc.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingId ? 'Chỉnh sửa user' : 'Thêm user mới' }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label>Email<input [(ngModel)]="form.email" name="email" type="email" required /></label>
        <label>Mật khẩu
          <input
            [(ngModel)]="form.password"
            name="password"
            type="password"
            [required]="!editingId"
            minlength="8"
            placeholder="{{ editingId ? 'Để trống nếu giữ nguyên' : '' }}" />
        </label>
        <label>Họ tên<input [(ngModel)]="form.fullName" name="fullName" required /></label>
        <label>Role
          <select [(ngModel)]="form.role" name="role" required>
            <option *ngFor="let r of roleOptions" [value]="r.value">{{r.label}}</option>
          </select>
        </label>
        <div class="actions">
          <button type="submit" class="primary">{{ editingId ? 'Cập nhật' : 'Lưu' }}</button>
          <button type="button" (click)="closeModal()">Huỷ</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .filters { display:flex; gap:10px; margin-bottom:16px; }
    input, select { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; }
    .data { width:100%; border-collapse:collapse; background:#fff; }
    th, td { padding:8px; border:1px solid #e2e8f0; text-align:left; }
    thead { background:#f1f5f9; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:4px 10px; border-radius:4px; cursor:pointer; margin-right:6px; }
    .danger { border:1px solid #dc2626; background:#dc2626; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; }
    .ghost:disabled, .danger:disabled { opacity:.4; cursor:not-allowed; }
    .actions-cell { white-space:nowrap; width:140px; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:340px; box-shadow:0 12px 32px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .error { color:#dc2626; }
  `]
})
export class UsersManagementComponent {
  users = signal<UserItem[]>([]);
  showModal = signal(false);
  error = signal('');
  search = '';
  roleFilter = '';
  form = { email: '', password: '', fullName: '', role: 'DIRECTOR' };
  editingId: string | null = null;

  roleOptions = [
    { value: 'DIRECTOR', label: 'Giám đốc' },
    { value: 'MANAGER', label: 'Quản lý' },
    { value: 'SALE', label: 'Sale' },
    { value: 'HCNS', label: 'HCNS' },
    { value: 'PARTIME', label: 'Partime' },
    { value: 'TEACHER', label: 'Giáo viên' }
  ];

  constructor(private userService: UserService, private auth: AuthService) {
    this.reload();
  }

  filtered = computed(() => {
    const term = this.search.toLowerCase();
    return this.users().filter(u =>
      (!this.roleFilter || u.role === this.roleFilter) &&
      (!term || u.email.toLowerCase().includes(term) || (u.fullName || '').toLowerCase().includes(term))
    );
  });

  translateRole(role: string) {
    return this.roleOptions.find(r => r.value === role)?.label || role;
  }

  async reload() {
    const data = await this.userService.list();
    this.users.set(data);
  }

  openModal(){
    this.error.set('');
    this.form = { email:'', password:'', fullName:'', role:'DIRECTOR' };
    this.editingId = null;
    this.showModal.set(true);
  }

  closeModal(){
    this.showModal.set(false);
    this.editingId = null;
  }

  async submit(){
    const payload = {
      email: this.form.email.trim(),
      password: this.form.password.trim(),
      fullName: this.form.fullName.trim(),
      role: this.form.role,
    };

    let success = false;
    if (this.editingId) {
      const updatePayload: any = { email: payload.email, fullName: payload.fullName, role: payload.role };
      if (payload.password) updatePayload.password = payload.password;
      success = await this.userService.update(this.editingId, updatePayload);
    } else {
      success = await this.userService.create(payload);
    }

    if (!success) {
      this.error.set('Thao tác thất bại');
      return;
    }
    this.closeModal();
    this.reload();
  }

  edit(user: UserItem) {
    this.editingId = user._id;
    this.form = { email: user.email, password: '', fullName: user.fullName, role: user.role };
    this.error.set('');
    this.showModal.set(true);
  }

  async remove(user: UserItem) {
    if (this.isSelf(user)) return;
    if (!confirm(`Xóa tài khoản ${user.email}?`)) return;
    const ok = await this.userService.remove(user._id);
    if (!ok) {
      alert('Không thể xóa tài khoản');
      return;
    }
    this.reload();
  }

  isSelf(user: UserItem): boolean {
    const current = this.auth.userSignal();
    return !!current && current.sub === user._id;
  }
}
