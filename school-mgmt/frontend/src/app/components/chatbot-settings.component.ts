import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService, FanpageItem, OpenAITokenItem } from '../services/chatbot.service';
import { AdsService, AdAccountItem } from '../services/ads.service';
import { AuthService } from '../services/auth.service';

const PLATFORM_LABELS: Record<string, string> = { FACEBOOK: 'Facebook', TIKTOK: 'TikTok' };
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Hoạt động', INACTIVE: 'Ngừng', EXPIRED: 'Hết hạn', REVOKED: 'Đã thu hồi' };
const STATUS_COLORS: Record<string, string> = { ACTIVE: '#10b981', INACTIVE: '#6b7280', EXPIRED: '#ef4444', REVOKED: '#ef4444' };

@Component({
  selector: 'app-chatbot-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Cài đặt Chatbot</h2>
      <p>Quản lý fanpage, token OpenAI cho chatbot tự động.</p>
    </div>
  </header>

  <div class="tabs">
    <button [class.active]="activeTab === 'fanpages'" (click)="switchTab('fanpages')">Fanpages</button>
    <button [class.active]="activeTab === 'tokens'" (click)="switchTab('tokens')">OpenAI Tokens</button>
  </div>

  <!-- ═══ Tab 1: Fanpages ═══ -->
  <ng-container *ngIf="activeTab === 'fanpages'">
    <section class="tab-header">
      <div class="filters">
        <input placeholder="Tìm tên, mã..." [(ngModel)]="fpKeyword" (ngModelChange)="loadFanpages()" />
        <select [(ngModel)]="fpFilterPlatform" (ngModelChange)="loadFanpages()">
          <option value="">Tất cả nền tảng</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="TIKTOK">TikTok</option>
        </select>
        <select [(ngModel)]="fpFilterStatus" (ngModelChange)="loadFanpages()">
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Ngừng</option>
        </select>
      </div>
      <button class="primary" (click)="openFanpageModal()">+ Thêm Fanpage</button>
    </section>

    <table class="data" *ngIf="fanpages().length; else emptyFanpages">
      <thead>
        <tr>
          <th>Mã</th>
          <th>Tên</th>
          <th>Nền tảng</th>
          <th>Page ID</th>
          <th>AI Auto</th>
          <th>Trạng thái</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let fp of fanpages()">
          <td><strong>{{fp.fanpageCode}}</strong></td>
          <td>{{fp.name}}</td>
          <td><span class="badge platform">{{platformLabel(fp.platform)}}</span></td>
          <td class="mono">{{fp.pageId}}</td>
          <td><span class="badge" [style.background]="fp.aiAutoReplyEnabled ? '#10b981' : '#6b7280'">{{fp.aiAutoReplyEnabled ? 'Bật' : 'Tắt'}}</span></td>
          <td><span class="badge" [style.background]="statusColor(fp.status)">{{statusLabel(fp.status)}}</span></td>
          <td class="actions-cell">
            <button class="ghost" (click)="editFanpage(fp)">Sửa</button>
            <button class="ghost danger" (click)="removeFanpage(fp)">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyFanpages>
      <div class="empty">Chưa có fanpage nào.</div>
    </ng-template>
  </ng-container>

  <!-- ═══ Tab 2: OpenAI Tokens ═══ -->
  <ng-container *ngIf="activeTab === 'tokens'">
    <section class="tab-header">
      <button class="primary" (click)="openTokenModal()">+ Thêm Token</button>
    </section>

    <table class="data" *ngIf="tokens().length; else emptyTokens">
      <thead>
        <tr>
          <th>Label</th>
          <th>API Key</th>
          <th>Model</th>
          <th>Temperature</th>
          <th>Max Tokens</th>
          <th>Trạng thái</th>
          <th>Sử dụng cuối</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let t of tokens()">
          <td><strong>{{t.label}}</strong></td>
          <td class="mono">{{t.apiKey}}</td>
          <td>{{t.model}}</td>
          <td>{{t.temperature}}</td>
          <td>{{t.maxTokens}}</td>
          <td><span class="badge" [style.background]="statusColor(t.status)">{{statusLabel(t.status)}}</span></td>
          <td>{{t.lastUsedAt ? formatDate(t.lastUsedAt) : '-'}}</td>
          <td class="actions-cell">
            <button class="ghost" (click)="editToken(t)">Sửa</button>
            <button class="ghost danger" (click)="removeToken(t)">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyTokens>
      <div class="empty">Chưa có token OpenAI nào.</div>
    </ng-template>
  </ng-container>

  <!-- ═══ Fanpage Modal ═══ -->
  <div class="modal-overlay" *ngIf="showFpModal()" (click)="closeFpModal()">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3>{{editingFpId ? 'Sửa Fanpage' : 'Thêm Fanpage'}}</h3>

      <label>Tên fanpage *</label>
      <input [(ngModel)]="fpForm.name" placeholder="VD: Trường ABC - Trang chính" />

      <label>Nền tảng *</label>
      <select [(ngModel)]="fpForm.platform" [disabled]="!!editingFpId">
        <option value="">-- Chọn --</option>
        <option value="FACEBOOK">Facebook</option>
        <option value="TIKTOK">TikTok</option>
      </select>

      <label>Page ID *</label>
      <input [(ngModel)]="fpForm.pageId" placeholder="ID fanpage trên nền tảng" />

      <label>Page Access Token</label>
      <input type="password" [(ngModel)]="fpForm.pageAccessToken" placeholder="Token để gửi tin nhắn" />

      <label>Mô tả fanpage (context cho AI)</label>
      <textarea [(ngModel)]="fpForm.description" rows="4" placeholder="Mô tả sản phẩm/dịch vụ để AI trả lời khách hàng..."></textarea>

      <label>Tài khoản quảng cáo liên kết</label>
      <select [(ngModel)]="fpForm.adAccountId">
        <option value="">-- Không liên kết --</option>
        <option *ngFor="let acc of adAccounts()" [value]="acc._id">{{acc.name}} ({{acc.platform}})</option>
      </select>

      <label>OpenAI Token</label>
      <select [(ngModel)]="fpForm.openaiTokenId">
        <option value="">-- Không dùng AI --</option>
        <option *ngFor="let t of tokens()" [value]="t._id">{{t.label}} ({{t.model}})</option>
      </select>

      <label>Webhook Verify Token</label>
      <input [(ngModel)]="fpForm.webhookVerifyToken" placeholder="Token xác thực webhook (Facebook)" />

      <label>App Secret</label>
      <input type="password" [(ngModel)]="fpForm.appSecret" placeholder="Secret để verify signature" />

      <div class="checkbox-row">
        <label><input type="checkbox" [(ngModel)]="fpForm.aiAutoReplyEnabled" /> AI tự động trả lời</label>
      </div>

      <div *ngIf="editingFpId" style="margin-top:8px">
        <label>Trạng thái</label>
        <select [(ngModel)]="fpForm.status">
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Ngừng</option>
        </select>
      </div>

      <div class="modal-actions">
        <button class="secondary" (click)="closeFpModal()">Hủy</button>
        <button class="primary" (click)="saveFanpage()" [disabled]="saving()">{{saving() ? 'Đang lưu...' : 'Lưu'}}</button>
      </div>
      <p class="error" *ngIf="fpError()">{{fpError()}}</p>
    </div>
  </div>

  <!-- ═══ Token Modal ═══ -->
  <div class="modal-overlay" *ngIf="showTokenModal()" (click)="closeTokenModal()">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3>{{editingTokenId ? 'Sửa Token' : 'Thêm Token'}}</h3>

      <label>Label *</label>
      <input [(ngModel)]="tokenForm.label" placeholder="VD: Production Key #1" />

      <label>API Key *</label>
      <input type="password" [(ngModel)]="tokenForm.apiKey" placeholder="sk-..." />

      <label>Model</label>
      <select [(ngModel)]="tokenForm.model">
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4-turbo">gpt-4-turbo</option>
        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
      </select>

      <label>Temperature ({{tokenForm.temperature}})</label>
      <input type="range" min="0" max="2" step="0.1" [(ngModel)]="tokenForm.temperature" />

      <label>Max Tokens</label>
      <input type="number" [(ngModel)]="tokenForm.maxTokens" min="100" max="16000" />

      <label>System Prompt Prefix</label>
      <textarea [(ngModel)]="tokenForm.systemPromptPrefix" rows="3" placeholder="Prefix thêm trước mô tả fanpage..."></textarea>

      <div *ngIf="editingTokenId" style="margin-top:8px">
        <label>Trạng thái</label>
        <select [(ngModel)]="tokenForm.status">
          <option value="ACTIVE">Hoạt động</option>
          <option value="EXPIRED">Hết hạn</option>
          <option value="REVOKED">Đã thu hồi</option>
        </select>
      </div>

      <div class="modal-actions">
        <button class="secondary" (click)="closeTokenModal()">Hủy</button>
        <button class="primary" (click)="saveToken()" [disabled]="saving()">{{saving() ? 'Đang lưu...' : 'Lưu'}}</button>
      </div>
      <p class="error" *ngIf="tokenError()">{{tokenError()}}</p>
    </div>
  </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; }
    .page-header { margin-bottom: 20px; }
    .page-header h2 { margin: 0 0 4px; font-size: 22px; }
    .page-header p { margin: 0; color: #666; font-size: 14px; }

    .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .tabs button { padding: 10px 20px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 500; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .2s; }
    .tabs button.active { color: #2563eb; border-bottom-color: #2563eb; }
    .tabs button:hover:not(.active) { color: #333; }

    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters input, .filters select { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .filters input { width: 200px; }

    table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.data th { text-align: left; padding: 10px 12px; background: #f8fafc; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; }
    table.data td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    table.data tbody tr:hover { background: #f8fafc; }
    .mono { font-family: monospace; font-size: 12px; color: #6b7280; }
    .amount { text-align: right; font-weight: 500; }
    .actions-cell { white-space: nowrap; }

    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #fff; }

    button.primary { padding: 8px 20px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    button.primary:hover { background: #1d4ed8; }
    button.primary:disabled { opacity: .6; cursor: not-allowed; }
    button.secondary { padding: 8px 20px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 13px; }
    button.ghost { padding: 4px 12px; background: none; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px; }
    button.ghost:hover { background: #f3f4f6; }
    button.ghost.danger { color: #ef4444; border-color: #fca5a5; }
    button.ghost.danger:hover { background: #fef2f2; }

    .empty { text-align: center; padding: 40px; color: #9ca3af; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #fff; border-radius: 12px; padding: 28px; width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .modal h3 { margin: 0 0 20px; font-size: 18px; }
    .modal label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin: 12px 0 4px; }
    .modal input, .modal select, .modal textarea { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box; }
    .modal input[type="range"] { padding: 0; }
    .modal textarea { resize: vertical; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
    .checkbox-row { margin-top: 12px; }
    .checkbox-row label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .error { color: #ef4444; font-size: 13px; margin-top: 8px; }
  `],
})
export class ChatbotSettingsComponent implements OnInit {
  activeTab = 'fanpages';

  // Fanpages
  fanpages = signal<FanpageItem[]>([]);
  fpKeyword = '';
  fpFilterPlatform = '';
  fpFilterStatus = '';
  showFpModal = signal(false);
  editingFpId = '';
  fpForm: any = this.emptyFpForm();
  fpError = signal('');

  // Tokens
  tokens = signal<OpenAITokenItem[]>([]);
  showTokenModal = signal(false);
  editingTokenId = '';
  tokenForm: any = this.emptyTokenForm();
  tokenError = signal('');

  // Ad accounts for dropdown
  adAccounts = signal<AdAccountItem[]>([]);

  saving = signal(false);

  constructor(
    private chatbotService: ChatbotService,
    private adsService: AdsService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadFanpages();
    this.loadTokens();
    this.loadAdAccounts();
  }

  switchTab(tab: string) { this.activeTab = tab; }

  platformLabel(p: string) { return PLATFORM_LABELS[p] || p; }
  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#999'; }

  formatDate(d: string) {
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ─── Fanpages ───────────────────────────────────────────────

  emptyFpForm() {
    return {
      name: '', platform: '', pageId: '', pageAccessToken: '', description: '',
      adAccountId: '', openaiTokenId: '', webhookVerifyToken: '', appSecret: '',
      aiAutoReplyEnabled: true, status: 'ACTIVE',
    };
  }

  async loadFanpages() {
    try {
      const params: Record<string, string> = {};
      if (this.fpKeyword) params['search'] = this.fpKeyword;
      if (this.fpFilterPlatform) params['platform'] = this.fpFilterPlatform;
      if (this.fpFilterStatus) params['status'] = this.fpFilterStatus;
      const res = await this.chatbotService.listFanpages(params);
      this.fanpages.set(res.data);
    } catch {}
  }

  async loadAdAccounts() {
    try {
      const res = await this.adsService.listAccounts({ limit: '100' });
      this.adAccounts.set(res.data);
    } catch {}
  }

  openFanpageModal() {
    this.editingFpId = '';
    this.fpForm = this.emptyFpForm();
    this.fpError.set('');
    this.showFpModal.set(true);
  }

  editFanpage(fp: FanpageItem) {
    this.editingFpId = fp._id;
    this.fpForm = {
      name: fp.name, platform: fp.platform, pageId: fp.pageId,
      pageAccessToken: '', description: fp.description || '',
      adAccountId: fp.adAccountId || '', openaiTokenId: fp.openaiTokenId || '',
      webhookVerifyToken: fp.webhookVerifyToken || '', appSecret: '',
      aiAutoReplyEnabled: fp.aiAutoReplyEnabled, status: fp.status,
    };
    this.fpError.set('');
    this.showFpModal.set(true);
  }

  closeFpModal() { this.showFpModal.set(false); }

  async saveFanpage() {
    if (!this.fpForm.name || !this.fpForm.platform || !this.fpForm.pageId) {
      this.fpError.set('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }
    this.saving.set(true);
    this.fpError.set('');

    const data: any = { ...this.fpForm };
    // Don't send empty sensitive fields on update
    if (this.editingFpId) {
      if (!data.pageAccessToken) delete data.pageAccessToken;
      if (!data.appSecret) delete data.appSecret;
    }
    if (!data.adAccountId) delete data.adAccountId;
    if (!data.openaiTokenId) delete data.openaiTokenId;

    const res = this.editingFpId
      ? await this.chatbotService.updateFanpage(this.editingFpId, data)
      : await this.chatbotService.createFanpage(data);

    this.saving.set(false);
    if (res.ok) {
      this.closeFpModal();
      await this.loadFanpages();
    } else {
      this.fpError.set(res.message || 'Lỗi');
    }
  }

  async removeFanpage(fp: FanpageItem) {
    if (!confirm(`Xóa fanpage "${fp.name}"?`)) return;
    await this.chatbotService.deleteFanpage(fp._id);
    await this.loadFanpages();
  }

  // ─── Tokens ─────────────────────────────────────────────────

  emptyTokenForm() {
    return {
      label: '', apiKey: '', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 2000,
      systemPromptPrefix: '', status: 'ACTIVE',
    };
  }

  async loadTokens() {
    try {
      const data = await this.chatbotService.listOpenAITokens();
      this.tokens.set(data);
    } catch {}
  }

  openTokenModal() {
    this.editingTokenId = '';
    this.tokenForm = this.emptyTokenForm();
    this.tokenError.set('');
    this.showTokenModal.set(true);
  }

  editToken(t: OpenAITokenItem) {
    this.editingTokenId = t._id;
    this.tokenForm = {
      label: t.label, apiKey: '', model: t.model,
      temperature: t.temperature ?? 0.7, maxTokens: t.maxTokens ?? 2000,
      systemPromptPrefix: t.systemPromptPrefix || '', status: t.status,
    };
    this.tokenError.set('');
    this.showTokenModal.set(true);
  }

  closeTokenModal() { this.showTokenModal.set(false); }

  async saveToken() {
    if (!this.tokenForm.label || (!this.editingTokenId && !this.tokenForm.apiKey)) {
      this.tokenError.set('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }
    this.saving.set(true);
    this.tokenError.set('');

    const data: any = { ...this.tokenForm };
    if (this.editingTokenId && !data.apiKey) delete data.apiKey;

    const res = this.editingTokenId
      ? await this.chatbotService.updateOpenAIToken(this.editingTokenId, data)
      : await this.chatbotService.createOpenAIToken(data);

    this.saving.set(false);
    if (res.ok) {
      this.closeTokenModal();
      await this.loadTokens();
    } else {
      this.tokenError.set(res.message || 'Lỗi');
    }
  }

  async removeToken(t: OpenAITokenItem) {
    if (!confirm(`Xóa token "${t.label}"?`)) return;
    await this.chatbotService.deleteOpenAIToken(t._id);
    await this.loadTokens();
  }
}
