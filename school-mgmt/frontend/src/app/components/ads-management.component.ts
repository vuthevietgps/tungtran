import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdsService, AdAccountItem, AdGroupItem, ApiTokenItem, AdCostItem } from '../services/ads.service';
import { AuthService } from '../services/auth.service';

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  TIKTOK: 'TikTok',
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  PAUSED: 'Tạm dừng',
  DISABLED: 'Vô hiệu',
};

const GROUP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  PAUSED: 'Tạm dừng',
  ARCHIVED: 'Lưu trữ',
};

const TOKEN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  EXPIRED: 'Hết hạn',
  REVOKED: 'Đã thu hồi',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  PAUSED: '#f59e0b',
  DISABLED: '#ef4444',
  ARCHIVED: '#6b7280',
  EXPIRED: '#ef4444',
  REVOKED: '#ef4444',
};

@Component({
  selector: 'app-ads-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý Quảng cáo</h2>
      <p>Quản lý tài khoản, nhóm QC, token API và chi phí ads.</p>
    </div>
  </header>

  <!-- Tabs -->
  <div class="tabs">
    <button [class.active]="activeTab === 'accounts'" (click)="switchTab('accounts')">Tài khoản QC</button>
    <button [class.active]="activeTab === 'groups'" (click)="switchTab('groups')">Nhóm QC</button>
    <button [class.active]="activeTab === 'tokens'" (click)="switchTab('tokens')">API Token</button>
    <button [class.active]="activeTab === 'costs'" (click)="switchTab('costs')">Chi phí Ads</button>
  </div>

  <!-- ═══ Tab 1: Ad Accounts ═══ -->
  <ng-container *ngIf="activeTab === 'accounts'">
    <section class="tab-header">
      <div class="filters">
        <input placeholder="Tìm tên, mã..." [(ngModel)]="accKeyword" (ngModelChange)="loadAccounts()" />
        <select [(ngModel)]="accFilterPlatform" (ngModelChange)="loadAccounts()">
          <option value="">Tất cả nền tảng</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="GOOGLE">Google</option>
          <option value="TIKTOK">TikTok</option>
        </select>
        <select [(ngModel)]="accFilterStatus" (ngModelChange)="loadAccounts()">
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="PAUSED">Tạm dừng</option>
          <option value="DISABLED">Vô hiệu</option>
        </select>
      </div>
      <button class="primary" (click)="openAccountModal()">+ Thêm tài khoản</button>
    </section>

    <table class="data" *ngIf="accounts().length; else emptyAccounts">
      <thead>
        <tr>
          <th>Mã</th>
          <th>Tên</th>
          <th>Nền tảng</th>
          <th>Account ID</th>
          <th>NS tháng</th>
          <th>Trạng thái</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let acc of accounts()">
          <td><strong>{{acc.accountCode}}</strong></td>
          <td>{{acc.name}}</td>
          <td><span class="badge platform" [attr.data-platform]="acc.platform">{{platformLabel(acc.platform)}}</span></td>
          <td class="mono">{{acc.platformAccountId}}</td>
          <td class="amount">{{acc.monthlyBudget ? (acc.monthlyBudget | number) + 'đ' : '-'}}</td>
          <td><span class="badge" [style.background]="statusColor(acc.status)">{{accountStatusLabel(acc.status)}}</span></td>
          <td class="actions-cell">
            <button class="ghost" (click)="editAccount(acc)">Sửa</button>
            <button class="ghost danger" (click)="removeAccount(acc)">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyAccounts><p class="empty">Chưa có tài khoản quảng cáo nào.</p></ng-template>
  </ng-container>

  <!-- ═══ Tab 2: Ad Groups ═══ -->
  <ng-container *ngIf="activeTab === 'groups'">
    <section class="tab-header">
      <div class="filters">
        <input placeholder="Tìm tên, mã..." [(ngModel)]="grpKeyword" (ngModelChange)="loadGroups()" />
        <select [(ngModel)]="grpFilterPlatform" (ngModelChange)="loadGroups()">
          <option value="">Tất cả nền tảng</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="GOOGLE">Google</option>
          <option value="TIKTOK">TikTok</option>
        </select>
        <select [(ngModel)]="grpFilterStatus" (ngModelChange)="loadGroups()">
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="PAUSED">Tạm dừng</option>
          <option value="ARCHIVED">Lưu trữ</option>
        </select>
        <select [(ngModel)]="grpFilterAccount" (ngModelChange)="loadGroups()">
          <option value="">Tất cả tài khoản</option>
          <option *ngFor="let acc of allAccounts()" [value]="acc._id">{{acc.name}}</option>
        </select>
      </div>
      <button class="primary" (click)="openGroupModal()">+ Thêm nhóm QC</button>
    </section>

    <table class="data" *ngIf="groups().length; else emptyGroups">
      <thead>
        <tr>
          <th>Mã</th>
          <th>Tên</th>
          <th>Tài khoản</th>
          <th>Nền tảng</th>
          <th>Campaign ID</th>
          <th>NS/ngày</th>
          <th>Trạng thái</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let grp of groups()">
          <td><strong>{{grp.groupCode}}</strong></td>
          <td>{{grp.name}}</td>
          <td>{{grp.adAccountName || '-'}}</td>
          <td><span class="badge platform" [attr.data-platform]="grp.platform">{{platformLabel(grp.platform)}}</span></td>
          <td class="mono">{{grp.platformCampaignId}}</td>
          <td class="amount">{{grp.dailyBudget ? (grp.dailyBudget | number) + 'đ' : '-'}}</td>
          <td><span class="badge" [style.background]="statusColor(grp.status)">{{groupStatusLabel(grp.status)}}</span></td>
          <td class="actions-cell">
            <button class="ghost" (click)="editGroup(grp)">Sửa</button>
            <button class="ghost danger" (click)="removeGroup(grp)">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyGroups><p class="empty">Chưa có nhóm quảng cáo nào.</p></ng-template>
  </ng-container>

  <!-- ═══ Tab 3: API Tokens ═══ -->
  <ng-container *ngIf="activeTab === 'tokens'">
    <section class="tab-header">
      <div class="filters">
        <select [(ngModel)]="tokenAccountId" (ngModelChange)="loadTokens()">
          <option value="">-- Chọn tài khoản --</option>
          <option *ngFor="let acc of allAccounts()" [value]="acc._id">{{acc.name}} ({{platformLabel(acc.platform)}})</option>
        </select>
      </div>
      <button class="primary" (click)="openTokenModal()" [disabled]="!tokenAccountId">+ Thêm Token</button>
    </section>

    <table class="data" *ngIf="tokens().length; else emptyTokens">
      <thead>
        <tr>
          <th>Tài khoản</th>
          <th>Nền tảng</th>
          <th>Label</th>
          <th>Access Token</th>
          <th>Trạng thái</th>
          <th>Hạn sử dụng</th>
          <th>Lần dùng cuối</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let t of tokens()">
          <td>{{t.adAccountName || '-'}}</td>
          <td><span class="badge platform" [attr.data-platform]="t.platform">{{platformLabel(t.platform)}}</span></td>
          <td>{{t.label || '-'}}</td>
          <td class="mono">{{t.accessToken}}</td>
          <td><span class="badge" [style.background]="statusColor(t.status)">{{tokenStatusLabel(t.status)}}</span></td>
          <td>{{t.expiresAt ? (t.expiresAt | date:'dd/MM/yyyy') : '-'}}</td>
          <td>{{t.lastUsedAt ? (t.lastUsedAt | date:'dd/MM/yyyy HH:mm') : '-'}}</td>
          <td class="actions-cell">
            <button class="ghost" (click)="editToken(t)">Sửa</button>
            <button class="ghost danger" (click)="removeToken(t)">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyTokens><p class="empty">{{tokenAccountId ? 'Chưa có token nào cho tài khoản này.' : 'Vui lòng chọn tài khoản.'}}</p></ng-template>
  </ng-container>

  <!-- ═══ Tab 4: Ad Costs ═══ -->
  <ng-container *ngIf="activeTab === 'costs'">
    <section class="tab-header">
      <div class="filters">
        <label>Từ <input type="date" [(ngModel)]="costStartDate" (ngModelChange)="loadCosts()" /></label>
        <label>Đến <input type="date" [(ngModel)]="costEndDate" (ngModelChange)="loadCosts()" /></label>
        <select [(ngModel)]="costFilterPlatform" (ngModelChange)="loadCosts()">
          <option value="">Tất cả nền tảng</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="GOOGLE">Google</option>
          <option value="TIKTOK">TikTok</option>
        </select>
        <select [(ngModel)]="costFilterGroup" (ngModelChange)="loadCosts()">
          <option value="">Tất cả nhóm QC</option>
          <option *ngFor="let g of allGroupsList()" [value]="g._id">{{g.name}}</option>
        </select>
      </div>
      <div class="btn-group">
        <button class="primary" (click)="openCostModal()">+ Nhập chi phí</button>
        <button class="success" (click)="triggerSync()" [disabled]="syncing()">
          {{syncing() ? 'Đang đồng bộ...' : 'Đồng bộ API'}}
        </button>
      </div>
    </section>

    <table class="data" *ngIf="costs().length; else emptyCosts">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhóm QC</th>
          <th>Nền tảng</th>
          <th>Chi phí</th>
          <th>Impressions</th>
          <th>Clicks</th>
          <th>Conversions</th>
          <th>Nguồn</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let c of costs()">
          <td>{{c.date | date:'dd/MM/yyyy'}}</td>
          <td>{{c.adGroupName || '-'}}</td>
          <td><span class="badge platform" [attr.data-platform]="c.platform">{{platformLabel(c.platform)}}</span></td>
          <td class="amount">{{c.spend | number}}đ</td>
          <td>{{c.impressions | number}}</td>
          <td>{{c.clicks | number}}</td>
          <td>{{c.conversions | number}}</td>
          <td><span class="badge source">{{c.source}}</span></td>
          <td class="actions-cell">
            <button class="ghost danger" (click)="removeCost(c)">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyCosts><p class="empty">Chưa có dữ liệu chi phí.</p></ng-template>
  </ng-container>

  <!-- ═══ Account Modal ═══ -->
  <div class="modal-backdrop" *ngIf="showAccountModal()">
    <div class="modal">
      <h3>{{editingAccount ? 'Sửa tài khoản QC' : 'Thêm tài khoản QC'}}</h3>
      <form (ngSubmit)="submitAccount()">
        <label>Tên tài khoản <input name="name" [(ngModel)]="accForm.name" required /></label>
        <label>Nền tảng
          <select name="platform" [(ngModel)]="accForm.platform" required [disabled]="!!editingAccount">
            <option value="">-- Chọn --</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="GOOGLE">Google</option>
            <option value="TIKTOK">TikTok</option>
          </select>
        </label>
        <label>Platform Account ID <input name="platformAccountId" [(ngModel)]="accForm.platformAccountId" required /></label>
        <label>Ngân sách tháng (VNĐ) <input name="monthlyBudget" type="number" [(ngModel)]="accForm.monthlyBudget" /></label>
        <label *ngIf="editingAccount">Trạng thái
          <select name="status" [(ngModel)]="accForm.status">
            <option value="ACTIVE">Hoạt động</option>
            <option value="PAUSED">Tạm dừng</option>
            <option value="DISABLED">Vô hiệu</option>
          </select>
        </label>
        <label>Ghi chú <textarea name="notes" [(ngModel)]="accForm.notes"></textarea></label>
        <div class="form-actions">
          <button type="submit" class="primary">Lưu</button>
          <button type="button" (click)="showAccountModal.set(false)">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>

  <!-- ═══ Group Modal ═══ -->
  <div class="modal-backdrop" *ngIf="showGroupModal()">
    <div class="modal">
      <h3>{{editingGroup ? 'Sửa nhóm QC' : 'Thêm nhóm QC'}}</h3>
      <form (ngSubmit)="submitGroup()">
        <label>Tên nhóm <input name="name" [(ngModel)]="grpForm.name" required /></label>
        <label>Tài khoản QC
          <select name="adAccountId" [(ngModel)]="grpForm.adAccountId" required [disabled]="!!editingGroup"
                  (ngModelChange)="onGroupAccountChange()">
            <option value="">-- Chọn --</option>
            <option *ngFor="let acc of allAccounts()" [value]="acc._id">{{acc.name}} ({{platformLabel(acc.platform)}})</option>
          </select>
        </label>
        <label>Platform Campaign ID <input name="platformCampaignId" [(ngModel)]="grpForm.platformCampaignId" required /></label>
        <label>Ngân sách/ngày (VNĐ) <input name="dailyBudget" type="number" [(ngModel)]="grpForm.dailyBudget" /></label>
        <label>Ngày bắt đầu <input name="startDate" type="date" [(ngModel)]="grpForm.startDate" /></label>
        <label>Ngày kết thúc <input name="endDate" type="date" [(ngModel)]="grpForm.endDate" /></label>
        <label>Đối tượng mục tiêu <input name="targetAudience" [(ngModel)]="grpForm.targetAudience" /></label>
        <label *ngIf="editingGroup">Trạng thái
          <select name="status" [(ngModel)]="grpForm.status">
            <option value="ACTIVE">Hoạt động</option>
            <option value="PAUSED">Tạm dừng</option>
            <option value="ARCHIVED">Lưu trữ</option>
          </select>
        </label>
        <label>Ghi chú <textarea name="notes" [(ngModel)]="grpForm.notes"></textarea></label>
        <div class="form-actions">
          <button type="submit" class="primary">Lưu</button>
          <button type="button" (click)="showGroupModal.set(false)">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>

  <!-- ═══ Token Modal ═══ -->
  <div class="modal-backdrop" *ngIf="showTokenModal()">
    <div class="modal">
      <h3>{{editingToken ? 'Sửa Token' : 'Thêm Token'}}</h3>
      <form (ngSubmit)="submitToken()">
        <label *ngIf="!editingToken">Tài khoản QC
          <select name="adAccountId" [(ngModel)]="tokenForm.adAccountId" required
                  (ngModelChange)="onTokenAccountChange()">
            <option value="">-- Chọn --</option>
            <option *ngFor="let acc of allAccounts()" [value]="acc._id">{{acc.name}} ({{platformLabel(acc.platform)}})</option>
          </select>
        </label>
        <label>Access Token <input name="accessToken" [(ngModel)]="tokenForm.accessToken" [required]="!editingToken" type="password" /></label>
        <label>Refresh Token <input name="refreshToken" [(ngModel)]="tokenForm.refreshToken" type="password" /></label>
        <label>Hạn sử dụng <input name="expiresAt" type="date" [(ngModel)]="tokenForm.expiresAt" /></label>
        <label>Nhãn <input name="label" [(ngModel)]="tokenForm.label" placeholder="VD: Main token" /></label>
        <label *ngIf="editingToken">Trạng thái
          <select name="status" [(ngModel)]="tokenForm.status">
            <option value="ACTIVE">Hoạt động</option>
            <option value="EXPIRED">Hết hạn</option>
            <option value="REVOKED">Đã thu hồi</option>
          </select>
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Lưu</button>
          <button type="button" (click)="showTokenModal.set(false)">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>

  <!-- ═══ Cost Modal ═══ -->
  <div class="modal-backdrop" *ngIf="showCostModal()">
    <div class="modal">
      <h3>Nhập chi phí thủ công</h3>
      <form (ngSubmit)="submitCost()">
        <label>Nhóm QC
          <select name="adGroupId" [(ngModel)]="costForm.adGroupId" required (ngModelChange)="onCostGroupChange()">
            <option value="">-- Chọn --</option>
            <option *ngFor="let g of allGroupsList()" [value]="g._id">{{g.name}} ({{platformLabel(g.platform)}})</option>
          </select>
        </label>
        <label>Ngày <input name="date" type="date" [(ngModel)]="costForm.date" required /></label>
        <label>Chi phí (VNĐ) <input name="spend" type="number" [(ngModel)]="costForm.spend" required min="0" /></label>
        <label>Impressions <input name="impressions" type="number" [(ngModel)]="costForm.impressions" min="0" /></label>
        <label>Clicks <input name="clicks" type="number" [(ngModel)]="costForm.clicks" min="0" /></label>
        <label>Conversions <input name="conversions" type="number" [(ngModel)]="costForm.conversions" min="0" /></label>
        <div class="form-actions">
          <button type="submit" class="primary">Lưu</button>
          <button type="button" (click)="showCostModal.set(false)">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>

  <!-- Sync result -->
  <div class="modal-backdrop" *ngIf="syncResult()">
    <div class="modal">
      <h3>Kết quả đồng bộ</h3>
      <p><strong>Đã đồng bộ:</strong> {{syncResult().synced || syncResult().data?.synced || 0}} bản ghi</p>
      <div *ngIf="syncResult().errors?.length || syncResult().data?.errors?.length">
        <p><strong>Lỗi:</strong></p>
        <ul>
          <li *ngFor="let e of (syncResult().errors || syncResult().data?.errors || [])">{{e}}</li>
        </ul>
      </div>
      <div class="form-actions">
        <button class="primary" (click)="syncResult.set(null); loadCosts()">Đóng</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 20px; }
    .page-header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }

    .tabs { display: flex; gap: 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; }
    .tabs button {
      padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent;
      cursor: pointer; font-size: 14px; font-weight: 500; color: #64748b; margin-bottom: -2px;
    }
    .tabs button.active { color: #3b82f6; border-bottom-color: #3b82f6; }
    .tabs button:hover { color: #1e40af; }

    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .filters input, .filters select { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .filters label { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #475569; }

    .btn-group { display: flex; gap: 8px; }

    table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.data th { text-align: left; padding: 8px 10px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 12px; }
    table.data td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    table.data tr:hover { background: #f8fafc; }
    td.mono { font-family: monospace; font-size: 12px; }
    td.amount { font-weight: 600; }
    .actions-cell { white-space: nowrap; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; color: #fff; }
    .badge.source { background: #6366f1; }
    .badge.platform { background: #3b82f6; }
    .badge.platform[data-platform="FACEBOOK"] { background: #1877f2; }
    .badge.platform[data-platform="GOOGLE"] { background: #ea4335; }
    .badge.platform[data-platform="TIKTOK"] { background: #000; }

    button.primary { padding: 8px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    button.primary:hover { background: #2563eb; }
    button.primary:disabled { background: #93c5fd; cursor: not-allowed; }
    button.success { padding: 8px 16px; background: #10b981; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    button.success:hover { background: #059669; }
    button.success:disabled { background: #6ee7b7; cursor: not-allowed; }
    button.ghost { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 13px; padding: 4px 8px; }
    button.ghost:hover { text-decoration: underline; }
    button.ghost.danger { color: #ef4444; }

    .empty { text-align: center; color: #94a3b8; padding: 40px; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; z-index: 1000; }
    .modal { background: #fff; border-radius: 12px; padding: 24px; width: 480px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
    .modal h3 { margin: 0 0 16px; font-size: 16px; }
    .modal label { display: block; margin-bottom: 12px; font-size: 13px; color: #475569; font-weight: 500; }
    .modal input, .modal select, .modal textarea { width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; margin-top: 4px; box-sizing: border-box; }
    .modal textarea { min-height: 60px; resize: vertical; }
    .form-actions { display: flex; gap: 8px; margin-top: 16px; }
    .error { color: #ef4444; font-size: 13px; margin-top: 8px; }
  `],
})
export class AdsManagementComponent implements OnInit {
  activeTab = 'accounts';

  // Signals
  accounts = signal<AdAccountItem[]>([]);
  allAccounts = signal<AdAccountItem[]>([]);
  groups = signal<AdGroupItem[]>([]);
  allGroupsList = signal<AdGroupItem[]>([]);
  tokens = signal<ApiTokenItem[]>([]);
  costs = signal<AdCostItem[]>([]);
  error = signal('');
  syncing = signal(false);
  syncResult = signal<any>(null);

  // Modals
  showAccountModal = signal(false);
  showGroupModal = signal(false);
  showTokenModal = signal(false);
  showCostModal = signal(false);

  // Editing references
  editingAccount: AdAccountItem | null = null;
  editingGroup: AdGroupItem | null = null;
  editingToken: ApiTokenItem | null = null;

  // Account filters
  accKeyword = '';
  accFilterPlatform = '';
  accFilterStatus = '';

  // Group filters
  grpKeyword = '';
  grpFilterPlatform = '';
  grpFilterStatus = '';
  grpFilterAccount = '';

  // Token filter
  tokenAccountId = '';

  // Cost filters
  costStartDate = '';
  costEndDate = '';
  costFilterPlatform = '';
  costFilterGroup = '';

  // Forms
  accForm: any = {};
  grpForm: any = {};
  tokenForm: any = {};
  costForm: any = {};

  constructor(
    private adsService: AdsService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    // Set default date range for costs (last 30 days)
    const now = new Date();
    this.costEndDate = now.toISOString().split('T')[0];
    const past = new Date(now.getTime() - 30 * 86400000);
    this.costStartDate = past.toISOString().split('T')[0];

    this.loadAccounts();
    this.loadAllAccounts();
    this.loadAllGroups();
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'accounts') this.loadAccounts();
    if (tab === 'groups') this.loadGroups();
    if (tab === 'tokens' && this.tokenAccountId) this.loadTokens();
    if (tab === 'costs') this.loadCosts();
  }

  // ─── Labels ─────────────────────────────────────────────

  platformLabel(p: string) { return PLATFORM_LABELS[p] || p; }
  accountStatusLabel(s: string) { return ACCOUNT_STATUS_LABELS[s] || s; }
  groupStatusLabel(s: string) { return GROUP_STATUS_LABELS[s] || s; }
  tokenStatusLabel(s: string) { return TOKEN_STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#6b7280'; }

  // ─── Load data ──────────────────────────────────────────

  async loadAccounts() {
    const params: Record<string, string> = {};
    if (this.accKeyword) params['search'] = this.accKeyword;
    if (this.accFilterPlatform) params['platform'] = this.accFilterPlatform;
    if (this.accFilterStatus) params['status'] = this.accFilterStatus;
    const res = await this.adsService.listAccounts(params);
    this.accounts.set(res.data);
  }

  async loadAllAccounts() {
    const res = await this.adsService.listAccounts({ limit: '200' });
    this.allAccounts.set(res.data);
  }

  async loadGroups() {
    const params: Record<string, string> = {};
    if (this.grpKeyword) params['search'] = this.grpKeyword;
    if (this.grpFilterPlatform) params['platform'] = this.grpFilterPlatform;
    if (this.grpFilterStatus) params['status'] = this.grpFilterStatus;
    if (this.grpFilterAccount) params['adAccountId'] = this.grpFilterAccount;
    const res = await this.adsService.listGroups(params);
    this.groups.set(res.data);
  }

  async loadAllGroups() {
    try {
      const groups = await this.adsService.getAllGroups();
      this.allGroupsList.set(groups);
    } catch {
      this.allGroupsList.set([]);
    }
  }

  async loadTokens() {
    if (!this.tokenAccountId) { this.tokens.set([]); return; }
    const res = await this.adsService.listTokens(this.tokenAccountId);
    this.tokens.set(res);
  }

  async loadCosts() {
    const params: Record<string, string> = {};
    if (this.costStartDate) params['startDate'] = this.costStartDate;
    if (this.costEndDate) params['endDate'] = this.costEndDate;
    if (this.costFilterPlatform) params['platform'] = this.costFilterPlatform;
    if (this.costFilterGroup) params['adGroupId'] = this.costFilterGroup;
    const res = await this.adsService.listCosts(params);
    this.costs.set(res.data);
  }

  // ─── Account CRUD ───────────────────────────────────────

  openAccountModal() {
    this.editingAccount = null;
    this.accForm = { name: '', platform: '', platformAccountId: '', monthlyBudget: 0, notes: '' };
    this.error.set('');
    this.showAccountModal.set(true);
  }

  editAccount(acc: AdAccountItem) {
    this.editingAccount = acc;
    this.accForm = { name: acc.name, platform: acc.platform, platformAccountId: acc.platformAccountId, monthlyBudget: acc.monthlyBudget || 0, status: acc.status, notes: acc.notes || '' };
    this.error.set('');
    this.showAccountModal.set(true);
  }

  async submitAccount() {
    this.error.set('');
    let result;
    if (this.editingAccount) {
      result = await this.adsService.updateAccount(this.editingAccount._id, this.accForm);
    } else {
      result = await this.adsService.createAccount(this.accForm);
    }
    if (!result.ok) { this.error.set(result.message || 'Lỗi'); return; }
    this.showAccountModal.set(false);
    this.loadAccounts();
    this.loadAllAccounts();
  }

  async removeAccount(acc: AdAccountItem) {
    if (!confirm(`Xóa tài khoản "${acc.name}"?`)) return;
    const result = await this.adsService.deleteAccount(acc._id);
    if (!result.ok) { alert(result.message); return; }
    this.loadAccounts();
    this.loadAllAccounts();
  }

  // ─── Group CRUD ─────────────────────────────────────────

  openGroupModal() {
    this.editingGroup = null;
    this.grpForm = { name: '', adAccountId: '', platform: '', platformCampaignId: '', dailyBudget: 0, startDate: '', endDate: '', targetAudience: '', notes: '' };
    this.error.set('');
    this.showGroupModal.set(true);
  }

  editGroup(grp: AdGroupItem) {
    this.editingGroup = grp;
    this.grpForm = {
      name: grp.name, adAccountId: grp.adAccountId, platform: grp.platform,
      platformCampaignId: grp.platformCampaignId, dailyBudget: grp.dailyBudget || 0,
      startDate: grp.startDate?.split('T')[0] || '', endDate: grp.endDate?.split('T')[0] || '',
      targetAudience: grp.targetAudience || '', status: grp.status, notes: grp.notes || '',
    };
    this.error.set('');
    this.showGroupModal.set(true);
  }

  onGroupAccountChange() {
    const acc = this.allAccounts().find(a => a._id === this.grpForm.adAccountId);
    if (acc) this.grpForm.platform = acc.platform;
  }

  async submitGroup() {
    this.error.set('');
    let result;
    if (this.editingGroup) {
      result = await this.adsService.updateGroup(this.editingGroup._id, this.grpForm);
    } else {
      result = await this.adsService.createGroup(this.grpForm);
    }
    if (!result.ok) { this.error.set(result.message || 'Lỗi'); return; }
    this.showGroupModal.set(false);
    this.loadGroups();
    this.loadAllGroups();
  }

  async removeGroup(grp: AdGroupItem) {
    if (!confirm(`Xóa nhóm QC "${grp.name}"?`)) return;
    const result = await this.adsService.deleteGroup(grp._id);
    if (!result.ok) { alert(result.message); return; }
    this.loadGroups();
    this.loadAllGroups();
  }

  // ─── Token CRUD ─────────────────────────────────────────

  openTokenModal() {
    this.editingToken = null;
    const acc = this.allAccounts().find(a => a._id === this.tokenAccountId);
    this.tokenForm = { adAccountId: this.tokenAccountId, platform: acc?.platform || '', accessToken: '', refreshToken: '', expiresAt: '', label: '' };
    this.error.set('');
    this.showTokenModal.set(true);
  }

  editToken(t: ApiTokenItem) {
    this.editingToken = t;
    this.tokenForm = { accessToken: '', refreshToken: '', expiresAt: t.expiresAt?.split('T')[0] || '', label: t.label || '', status: t.status };
    this.error.set('');
    this.showTokenModal.set(true);
  }

  onTokenAccountChange() {
    const acc = this.allAccounts().find(a => a._id === this.tokenForm.adAccountId);
    if (acc) this.tokenForm.platform = acc.platform;
  }

  async submitToken() {
    this.error.set('');
    let result;
    if (this.editingToken) {
      const data: any = {};
      if (this.tokenForm.accessToken) data.accessToken = this.tokenForm.accessToken;
      if (this.tokenForm.refreshToken) data.refreshToken = this.tokenForm.refreshToken;
      if (this.tokenForm.expiresAt) data.expiresAt = this.tokenForm.expiresAt;
      if (this.tokenForm.label) data.label = this.tokenForm.label;
      if (this.tokenForm.status) data.status = this.tokenForm.status;
      result = await this.adsService.updateToken(this.editingToken._id, data);
    } else {
      result = await this.adsService.createToken(this.tokenForm);
    }
    if (!result.ok) { this.error.set(result.message || 'Lỗi'); return; }
    this.showTokenModal.set(false);
    this.loadTokens();
  }

  async removeToken(t: ApiTokenItem) {
    if (!confirm('Xóa token này?')) return;
    const result = await this.adsService.deleteToken(t._id);
    if (!result.ok) { alert(result.message); return; }
    this.loadTokens();
  }

  // ─── Cost entry ─────────────────────────────────────────

  openCostModal() {
    this.costForm = { adGroupId: '', adAccountId: '', platform: '', date: new Date().toISOString().split('T')[0], spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    this.error.set('');
    this.showCostModal.set(true);
  }

  onCostGroupChange() {
    const grp = this.allGroupsList().find(g => g._id === this.costForm.adGroupId);
    if (grp) {
      this.costForm.adAccountId = grp.adAccountId;
      this.costForm.platform = grp.platform;
    }
  }

  async submitCost() {
    this.error.set('');
    const result = await this.adsService.createCost({ ...this.costForm, source: 'MANUAL' });
    if (!result.ok) { this.error.set(result.message || 'Lỗi'); return; }
    this.showCostModal.set(false);
    this.loadCosts();
  }

  async removeCost(c: AdCostItem) {
    if (!confirm('Xóa bản ghi chi phí này?')) return;
    const result = await this.adsService.deleteCost(c._id);
    if (!result.ok) { alert(result.message); return; }
    this.loadCosts();
  }

  // ─── Sync ───────────────────────────────────────────────

  async triggerSync() {
    this.syncing.set(true);
    const result = await this.adsService.triggerSync();
    this.syncing.set(false);
    if (result.ok) {
      this.syncResult.set(result.data || result);
    } else {
      alert(result.message || 'Đồng bộ thất bại');
    }
  }
}
