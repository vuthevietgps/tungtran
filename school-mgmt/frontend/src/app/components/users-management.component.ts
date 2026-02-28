import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService, UserItem } from '../services/user.service';
import { AuthService } from '../services/auth.service';

interface RoleOption {
  value: string;
  label: string;
  codeLabel: string;
  codeHint: string;
}

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>{{ parentMode() ? 'Quan ly tai khoan phu huynh' : 'Quan ly tai khoan' }}</h2>
      <p>{{ parentMode() ? 'Tao moi, chinh sua va tim kiem tai khoan phu huynh.' : 'Them moi, loc va tim kiem tai khoan trong he thong.' }}</p>
    </div>
    <button class="primary" (click)="openModal()">{{ parentMode() ? '+ Them phu huynh' : '+ Them moi' }}</button>
  </header>

  <section class="scope-tabs">
    <button type="button" [class.active]="!parentMode()" (click)="showAllAccounts()">Tat ca tai khoan</button>
    <button type="button" [class.active]="parentMode()" (click)="showParentAccounts()">Tai khoan phu huynh</button>
  </section>

  <section class="filters">
    <input placeholder="Tim theo ma, email hoac ho ten" [(ngModel)]="search" />
    <select [(ngModel)]="roleFilter">
      <option value="">Tat ca role</option>
      <option *ngFor="let r of roleOptions" [value]="r.value">{{ r.label }}</option>
    </select>
    <button (click)="reload()">Lam moi</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead>
      <tr><th>Ma TK</th><th>Email</th><th>Ho ten</th><th>Role</th><th>Trang thai</th><th>Hanh dong</th></tr>
    </thead>
    <tbody>
      <tr *ngFor="let u of filtered()">
        <td><strong>{{ u.userCode || '-' }}</strong></td>
        <td>{{ u.email }}</td>
        <td>{{ u.fullName }}</td>
        <td>{{ translateRole(u.role) }}</td>
        <td>{{ u.status || 'N/A' }}</td>
        <td class="actions-cell">
          <button class="ghost" (click)="edit(u)" [disabled]="isSelf(u)">Sua</button>
          <button class="danger" (click)="remove(u)" [disabled]="isSelf(u)">Xoa</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Khong co du lieu hoac khong trung bo loc.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingId ? 'Chinh sua tai khoan' : (parentMode() ? 'Them tai khoan phu huynh' : 'Them tai khoan moi') }}</h3>
      <form (ngSubmit)="submit()">
        <label>{{ getCodeLabel(form.role) }}
          <input
            [(ngModel)]="form.userCode"
            name="userCode"
            required
            placeholder="{{ getCodeHint(form.role) }}" />
        </label>
        <label>Email<input [(ngModel)]="form.email" name="email" type="email" required /></label>
        <label>Mat khau
          <input
            [(ngModel)]="form.password"
            name="password"
            type="password"
            [required]="!editingId"
            minlength="8"
            placeholder="{{ editingId ? 'De trong neu giu nguyen' : '' }}" />
        </label>
        <label>Ho ten<input [(ngModel)]="form.fullName" name="fullName" required /></label>
        <label>Role
          <select [(ngModel)]="form.role" name="role" required [disabled]="isSelfEditing()">
            <option *ngFor="let r of roleOptions" [value]="r.value">{{ r.label }}</option>
          </select>
        </label>
        <ng-container *ngIf="isParentRole(form.role)">
          <label>Link Facebook
            <input
              [(ngModel)]="form.facebookLink"
              name="facebookLink"
              placeholder="https://facebook.com/..." />
          </label>
          <label>Dia chi
            <input
              [(ngModel)]="form.address"
              name="address"
              placeholder="Nhap dia chi phu huynh" />
          </label>
        </ng-container>
        <small class="hint" *ngIf="isSelfEditing()">Khong the doi role cua tai khoan dang dang nhap.</small>
        <div class="actions">
          <button type="submit" class="primary">{{ editingId ? 'Cap nhat' : 'Luu' }}</button>
          <button type="button" (click)="closeModal()">Huy</button>
        </div>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:12px; }
    .page-header h2 { margin:0 0 4px; }
    .page-header p { margin:0; color:#475569; }
    .scope-tabs { display:flex; gap:8px; margin-bottom:12px; }
    .scope-tabs button { border:1px solid #cbd5e1; background:#fff; padding:6px 10px; border-radius:999px; cursor:pointer; font-weight:500; }
    .scope-tabs button.active { border-color:#2563eb; color:#1d4ed8; background:#eff6ff; }
    .filters { display:flex; gap:10px; margin-bottom:16px; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; }
    .data { width:100%; border-collapse:collapse; background:#fff; }
    th, td { padding:8px; border:1px solid #e2e8f0; text-align:left; }
    thead { background:#f1f5f9; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:4px 10px; border-radius:4px; cursor:pointer; margin-right:6px; }
    .danger { border:1px solid #dc2626; background:#dc2626; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; }
    .ghost:disabled, .danger:disabled { opacity:.4; cursor:not-allowed; }
    .actions-cell { white-space:nowrap; width:140px; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:380px; box-shadow:0 12px 32px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .hint { color:#64748b; font-size:12px; }
    .error { color:#dc2626; margin:0; }
  `]
})
export class UsersManagementComponent {
  private readonly parentRole = 'PARENT';

  users = signal<UserItem[]>([]);
  showModal = signal(false);
  error = signal('');
  parentMode = signal(false);

  search = '';
  roleFilter = '';
  form = {
    userCode: '',
    email: '',
    password: '',
    fullName: '',
    role: 'DIRECTOR',
    facebookLink: '',
    address: '',
  };
  editingId: string | null = null;

  roleOptions: RoleOption[] = [
    { value: 'DIRECTOR', label: 'Giam doc', codeLabel: 'Ma giam doc', codeHint: 'VD: GD001' },
    { value: 'ACCOUNTING', label: 'Ke toan', codeLabel: 'Ma ke toan', codeHint: 'VD: KT001' },
    { value: 'OPS', label: 'Van hanh', codeLabel: 'Ma van hanh', codeHint: 'VD: OPS001' },
    { value: 'SALE', label: 'Sale', codeLabel: 'Ma sale', codeHint: 'VD: SALE001' },
    { value: 'TEACHER', label: 'Giao vien', codeLabel: 'Ma giao vien', codeHint: 'VD: GV001' },
    { value: 'PARENT', label: 'Phu huynh', codeLabel: 'Ma phu huynh', codeHint: 'VD: PH001' },
    { value: 'MANAGER', label: 'Quan ly (legacy)', codeLabel: 'Ma quan ly', codeHint: 'VD: QL001' },
    { value: 'HCNS', label: 'HCNS (legacy)', codeLabel: 'Ma HCNS', codeHint: 'VD: HCNS001' },
    { value: 'PARTIME', label: 'Partime (legacy)', codeLabel: 'Ma partime', codeHint: 'VD: PT001' },
    { value: 'STAFF', label: 'Nhan vien (legacy)', codeLabel: 'Ma nhan vien', codeHint: 'VD: NV001' },
  ];

  constructor(
    private userService: UserService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.route.queryParamMap.subscribe((params) => {
      const isParentMode = (params.get('role') || '').toUpperCase() === this.parentRole;
      const wasParentMode = this.parentMode();
      this.parentMode.set(isParentMode);

      if (isParentMode) this.roleFilter = this.parentRole;
      if (!isParentMode && wasParentMode && this.roleFilter === this.parentRole) this.roleFilter = '';
    });
    this.reload();
  }

  filtered = computed(() => {
    const term = this.search.trim().toLowerCase();
    return this.users().filter((u) =>
      (!this.roleFilter || u.role === this.roleFilter) &&
      (!term ||
        (u.userCode || '').toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.fullName || '').toLowerCase().includes(term))
    );
  });

  translateRole(role: string) {
    return this.roleOptions.find((r) => r.value === role)?.label || role;
  }

  getCodeLabel(role: string) {
    return this.roleOptions.find((r) => r.value === role)?.codeLabel || 'Ma tai khoan';
  }

  getCodeHint(role: string) {
    return this.roleOptions.find((r) => r.value === role)?.codeHint || 'VD: TK001';
  }

  isSelfEditing(): boolean {
    if (!this.editingId) return false;
    const current = this.auth.userSignal();
    return !!current && current.sub === this.editingId;
  }

  isParentRole(role: string): boolean {
    return role === this.parentRole;
  }

  async reload() {
    const data = await this.userService.list();
    this.users.set(data);
  }

  async showAllAccounts() {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { role: null },
      queryParamsHandling: 'merge',
    });
  }

  async showParentAccounts() {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { role: this.parentRole },
      queryParamsHandling: 'merge',
    });
  }

  openModal() {
    this.error.set('');
    this.form = {
      userCode: '',
      email: '',
      password: '',
      fullName: '',
      role: this.parentMode() ? this.parentRole : 'DIRECTOR',
      facebookLink: '',
      address: '',
    };
    this.editingId = null;
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
  }

  async submit() {
    const userCode = this.form.userCode.trim().toUpperCase();
    const selfEditing = this.isSelfEditing();
    if (!userCode) {
      this.error.set('Vui long nhap ma tai khoan');
      return;
    }

    try {
      const isParentRole = this.isParentRole(this.form.role);
      const payload = {
        userCode,
        email: this.form.email.trim(),
        password: this.form.password.trim(),
        fullName: this.form.fullName.trim(),
        role: this.form.role,
        facebookLink: isParentRole ? this.form.facebookLink.trim() : undefined,
        address: isParentRole ? this.form.address.trim() : undefined,
      };

      if (this.editingId) {
        const updatePayload: any = {
          userCode: payload.userCode,
          email: payload.email,
          fullName: payload.fullName,
          role: payload.role,
          facebookLink: payload.facebookLink,
          address: payload.address,
        };
        if (payload.password) updatePayload.password = payload.password;

        if (selfEditing) {
          delete updatePayload.role;
        }

        await this.userService.update(this.editingId, updatePayload);
      } else {
        await this.userService.create(payload);
      }

      this.closeModal();
      await this.reload();
    } catch {
      this.error.set('Thao tac that bai, vui long kiem tra trung ma/email');
    }
  }

  edit(user: UserItem) {
    this.editingId = user._id;
    this.form = {
      userCode: (user.userCode || '').trim(),
      email: user.email,
      password: '',
      fullName: user.fullName,
      role: user.role,
      facebookLink: user.facebookLink || '',
      address: user.address || '',
    };
    this.error.set('');
    this.showModal.set(true);
  }

  async remove(user: UserItem) {
    if (this.isSelf(user)) return;
    if (!confirm(`Xoa tai khoan ${user.email}?`)) return;
    try {
      await this.userService.remove(user._id);
      await this.reload();
    } catch {
      alert('Khong the xoa tai khoan');
    }
  }

  isSelf(user: UserItem): boolean {
    const current = this.auth.userSignal();
    return !!current && current.sub === user._id;
  }
}
