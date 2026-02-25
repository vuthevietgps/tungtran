import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  InvoiceItem,
  InvoiceService,
  InvoiceStatus,
  InvoiceUpsertPayload,
} from '../services/invoice.service';
import { StudentItem, StudentService } from '../services/student.service';
import { AuthService } from '../services/auth.service';
import { UserItem, UserService } from '../services/user.service';
import { environment } from '../../environments/environment';

interface InvoiceForm {
  invoiceNumber: string;
  studentId: string;
  classType: 'ONLINE' | 'OFFLINE' | '';
  saleId: string;
  sessions: number;
  amount: number;
  paymentDate: string;
  description: string;
  receiptImage: string;
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Quáº£n lÃ½ hÃ³a Ä‘Æ¡n</h2>
      <p>Theo dÃµi thanh toÃ¡n vÃ  doanh thu theo loáº¡i lá»›p há»c.</p>
    </div>
    <button class="primary" (click)="openModal()" *ngIf="activeTab === 'invoices'">+ ThÃªm hÃ³a Ä‘Æ¡n</button>
  </header>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button [class.active]="activeTab === 'invoices'" (click)="activeTab = 'invoices'">ðŸ“„ HÃ³a Ä‘Æ¡n</button>
    <button [class.active]="activeTab === 'topups'" (click)="activeTab = 'topups'; loadPendingTopUps()" *ngIf="canApproveInvoices">
      ðŸ’³ YÃªu cáº§u náº¡p vÃ­ <span *ngIf="pendingTopUps().length" class="badge-count">{{pendingTopUps().length}}</span>
    </button>
  </div>

  <!-- â”€â”€â”€â”€â”€ INVOICES TAB â”€â”€â”€â”€â”€ -->
  <ng-container *ngIf="activeTab === 'invoices'">

    <!-- Stats cards -->
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-label">Tá»•ng hÃ³a Ä‘Æ¡n</div>
        <div class="stat-value">{{ summary().total }}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">ðŸŒ Doanh thu Online</div>
        <div class="stat-value">{{ formatCurrency(summary().onlineAmount) }}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">ðŸ« Doanh thu Offline</div>
        <div class="stat-value">{{ formatCurrency(summary().offlineAmount) }}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">âœ… ÄÃ£ duyá»‡t</div>
        <div class="stat-value">{{ formatCurrency(summary().approvedAmount) }}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-label">â³ Chá» duyá»‡t</div>
        <div class="stat-value">{{ summary().pendingCount }} hÃ³a Ä‘Æ¡n</div>
      </div>
    </div>

    <!-- Filters -->
    <section class="filters-section">
      <div class="filter-row">
        <input
          class="filter-input"
          placeholder="ðŸ” TÃ¬m sá»‘ hÃ³a Ä‘Æ¡n, tÃªn há»c sinh..."
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
        />
        <input
          class="filter-input"
          placeholder="ðŸ‘¨â€ðŸ‘©â€ðŸ‘§ TÃ¬m tÃªn / SÄT phá»¥ huynh..."
          [ngModel]="parentFilter()"
          (ngModelChange)="parentFilter.set($event)"
        />
        <input
          class="filter-input"
          placeholder="ðŸ‘¤ TÃ¬m tÃªn sale..."
          [ngModel]="saleFilter()"
          (ngModelChange)="saleFilter.set($event)"
        />
      </div>
      <div class="filter-row">
        <select [ngModel]="classTypeFilter()" (ngModelChange)="classTypeFilter.set($event)">
          <option value="">Táº¥t cáº£ loáº¡i lá»›p</option>
          <option value="ONLINE">ðŸŒ Online</option>
          <option value="OFFLINE">ðŸ« Offline</option>
        </select>
        <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
          <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
          <option value="PENDING_APPROVAL">Chá» duyá»‡t</option>
          <option value="APPROVED">ÄÃ£ duyá»‡t</option>
          <option value="REJECTED">Tá»« chá»‘i</option>
          <option value="CANCELLED">ÄÃ£ há»§y</option>
        </select>
        <label class="date-wrap">
          <span>Tá»« ngÃ y</span>
          <input type="date" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" />
        </label>
        <label class="date-wrap">
          <span>Äáº¿n ngÃ y</span>
          <input type="date" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" />
        </label>
        <button (click)="reload()">ðŸ”„ LÃ m má»›i</button>
        <button class="ghost" (click)="clearFilters()" *ngIf="hasActiveFilters()">âœ• XÃ³a lá»c</button>
      </div>
    </section>

    <!-- Result count -->
    <div class="result-meta">
      Hiá»ƒn thá»‹ <strong>{{ filtered().length }}</strong> / {{ items().length }} hÃ³a Ä‘Æ¡n
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table class="data" *ngIf="filtered().length; else empty">
        <thead>
          <tr>
            <th>Sá»‘ hÃ³a Ä‘Æ¡n</th>
            <th>Há»c sinh</th>
            <th>Phá»¥ huynh</th>
            <th>Loáº¡i lá»›p</th>
            <th>Sá»‘ buá»•i</th>
            <th>Tá»•ng tiá»n</th>
            <th>Sale phá»¥ trÃ¡ch</th>
            <th>NgÃ y TT</th>
            <th>Tráº¡ng thÃ¡i</th>
            <th>Chá»©ng tá»«</th>
            <th>HÃ nh Ä‘á»™ng</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let invoice of filtered()">
            <td><strong>{{ invoice.invoiceNumber }}</strong></td>
            <td>
              <div>{{ invoice.studentId.fullName }}</div>
              <small class="muted-text">{{ invoice.studentId.studentCode }}</small>
            </td>
            <td>
              <div>{{ invoice.studentId.parentName }}</div>
              <small class="muted-text">{{ invoice.studentId.parentPhone }}</small>
            </td>
            <td>
              <span *ngIf="invoice.classType === 'ONLINE'" class="chip chip-blue">ðŸŒ Online</span>
              <span *ngIf="invoice.classType === 'OFFLINE'" class="chip chip-orange">ðŸ« Offline</span>
              <span *ngIf="!invoice.classType" class="muted-text">â€”</span>
            </td>
            <td class="center">{{ invoice.sessions || 'â€”' }}</td>
            <td class="right"><strong>{{ formatCurrency(invoice.amount) }}</strong></td>
            <td>
              <span *ngIf="invoice.saleId">{{ invoice.saleId.fullName }}</span>
              <span *ngIf="!invoice.saleId" class="muted-text">â€”</span>
            </td>
            <td>{{ formatDate(invoice.paymentDate) }}</td>
            <td>
              <span [ngClass]="['status', getStatusClass(invoice.status)]">
                {{ getStatusText(invoice.status) }}
              </span>
            </td>
            <td>
              <div class="proof-stack">
                <img
                  *ngIf="invoice.receiptImage"
                  [src]="getImageUrl(invoice.receiptImage)"
                  alt="Chá»©ng tá»« gá»‘c"
                  class="receipt-thumb"
                  title="Chá»©ng tá»« gá»‘c"
                  (click)="showImageModal(getImageUrl(invoice.receiptImage))"
                />
                <img
                  *ngIf="invoice.approvalImage"
                  [src]="getImageUrl(invoice.approvalImage)"
                  alt="áº¢nh xÃ¡c nháº­n duyá»‡t"
                  class="receipt-thumb approval-thumb"
                  title="áº¢nh xÃ¡c nháº­n duyá»‡t"
                  (click)="showImageModal(getImageUrl(invoice.approvalImage))"
                />
                <span *ngIf="!invoice.receiptImage && !invoice.approvalImage" class="muted-text">â€”</span>
              </div>
            </td>
            <td class="actions-cell">
              <button class="ghost" (click)="edit(invoice)">Sá»­a</button>
              <button
                class="ghost success"
                *ngIf="canApproveInvoices && invoice.status === 'PENDING_APPROVAL'"
                (click)="openApproveModal(invoice)">
                Duyá»‡t
              </button>
              <button
                class="ghost danger"
                *ngIf="canApproveInvoices && invoice.status === 'PENDING_APPROVAL'"
                (click)="reject(invoice)">
                Tá»« chá»‘i
              </button>
              <button class="ghost danger" (click)="remove(invoice)" *ngIf="canDeleteInvoices">XÃ³a</button>
            </td>
          </tr>
        </tbody>
      </table>
      <ng-template #empty>
        <p class="empty-msg">KhÃ´ng cÃ³ hÃ³a Ä‘Æ¡n nÃ o phÃ¹ há»£p vá»›i bá»™ lá»c.</p>
      </ng-template>
    </div>
  </ng-container>

  <!-- â”€â”€â”€â”€â”€ TOPUPS TAB â”€â”€â”€â”€â”€ -->
  <ng-container *ngIf="activeTab === 'topups'">
    <div class="topup-header">
      <h3>YÃªu cáº§u náº¡p tiá»n vÃ o vÃ­ tá»« phá»¥ huynh</h3>
      <button class="ghost" (click)="loadPendingTopUps()">ðŸ”„ LÃ m má»›i</button>
    </div>
    <div *ngIf="loadingTopUps()" class="hint">Äang táº£i...</div>
    <table class="data" *ngIf="!loadingTopUps() && pendingTopUps().length; else emptyTopUps">
      <thead>
        <tr>
          <th>Phá»¥ huynh</th>
          <th>Sá»‘ tiá»n</th>
          <th>PhÆ°Æ¡ng thá»©c</th>
          <th>MÃ£ GD</th>
          <th>Chá»©ng tá»«</th>
          <th>Thá»i gian</th>
          <th>HÃ nh Ä‘á»™ng</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let req of pendingTopUps()">
          <td>
            <strong>{{req.userId?.fullName || 'â€”'}}</strong><br/>
            <small>{{req.userId?.phone || req.userId?.email || ''}}</small>
          </td>
          <td class="right"><strong>{{formatCurrency(req.amount)}}</strong></td>
          <td><span class="chip">{{methodLabel(req.paymentMethod)}}</span></td>
          <td>{{req.transactionRef || 'â€”'}}</td>
          <td>
            <a *ngIf="req.receiptImageUrl" [href]="getImageUrl(req.receiptImageUrl)" target="_blank" rel="noopener">
              <img [src]="getImageUrl(req.receiptImageUrl)" alt="Chá»©ng tá»«" class="receipt-thumb" />
            </a>
            <span *ngIf="!req.receiptImageUrl" class="muted-text">KhÃ´ng cÃ³</span>
          </td>
          <td>{{req.createdAt | date:'dd/MM/yyyy HH:mm'}}</td>
          <td class="actions-cell">
            <button class="ghost success" (click)="approveTopUpRequest(req)">âœ… Duyá»‡t</button>
            <button class="ghost danger" (click)="rejectTopUpRequest(req)">âŒ Tá»« chá»‘i</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyTopUps>
      <p *ngIf="!loadingTopUps()" class="empty-msg">KhÃ´ng cÃ³ yÃªu cáº§u náº¡p tiá»n nÃ o Ä‘ang chá» duyá»‡t.</p>
    </ng-template>
  </ng-container>

  <!-- â”€â”€â”€â”€â”€ INVOICE FORM MODAL â”€â”€â”€â”€â”€ -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingInvoice ? 'Sá»­a hÃ³a Ä‘Æ¡n' : 'ThÃªm hÃ³a Ä‘Æ¡n má»›i' }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">

        <label>Sá»‘ hÃ³a Ä‘Æ¡n <span class="req">*</span>
          <input name="invoiceNumber" [(ngModel)]="form.invoiceNumber" required placeholder="VD: HD20240001" />
        </label>

        <label>Há»c sinh <span class="req">*</span>
          <select name="studentId" [(ngModel)]="form.studentId" required (ngModelChange)="onStudentChange()">
            <option value="">-- Chá»n há»c sinh --</option>
            <option *ngFor="let s of students()" [value]="s._id">
              {{ s.fullName }} ({{ s.studentCode }})
            </option>
          </select>
        </label>

        <!-- Auto-loaded parent info -->
        <div class="parent-info-box" *ngIf="selectedStudent">
          <span class="parent-info-label">Phá»¥ huynh:</span>
          <strong>{{ selectedStudent.parentName }}</strong>
          <span class="parent-info-phone"> â€” {{ selectedStudent.parentPhone }}</span>
        </div>

        <div class="form-row">
          <label>Loáº¡i lá»›p há»c <span class="req">*</span>
            <select name="classType" [(ngModel)]="form.classType" required>
              <option value="">-- Chá»n loáº¡i lá»›p --</option>
              <option value="ONLINE">ðŸŒ Online</option>
              <option value="OFFLINE">ðŸ« Offline</option>
            </select>
          </label>
          <label>Sá»‘ buá»•i Ä‘Äƒng kÃ½
            <input name="sessions" type="number" min="1" [(ngModel)]="form.sessions" placeholder="VD: 20" />
          </label>
        </div>

        <label>Tá»•ng tiá»n (VND) <span class="req">*</span>
          <input name="amount" type="number" min="0" [(ngModel)]="form.amount" required placeholder="VD: 3800000" />
        </label>

        <label>Sale phá»¥ trÃ¡ch
          <div *ngIf="isSale" class="readonly-field">{{ currentUserName }} (báº¡n)</div>
          <select *ngIf="!isSale" name="saleId" [(ngModel)]="form.saleId">
            <option value="">-- KhÃ´ng cÃ³ / Chá»n sale --</option>
            <option *ngFor="let s of sales()" [value]="s._id">{{ s.fullName }}</option>
          </select>
        </label>

        <label>NgÃ y thanh toÃ¡n <span class="req">*</span>
          <input name="paymentDate" type="date" [(ngModel)]="form.paymentDate" required />
        </label>

        <p class="hint">HÃ³a Ä‘Æ¡n má»›i sáº½ á»Ÿ tráº¡ng thÃ¡i chá» duyá»‡t. Sau khi duyá»‡t, vÃ­ phá»¥ huynh sáº½ Ä‘Æ°á»£c cá»™ng tiá»n.</p>

        <label>MÃ´ táº£
          <textarea
            name="description"
            [(ngModel)]="form.description"
            rows="2"
            placeholder="MÃ´ táº£ hÃ³a Ä‘Æ¡n (tÃ¹y chá»n)"></textarea>
        </label>

        <label>áº¢nh chá»©ng tá»« (tÃ¹y chá»n)
          <input name="receiptImage" type="file" accept="image/*" (change)="handleFileChange($event)" />
        </label>

        <div class="upload-status">
          <span *ngIf="uploading()">Äang táº£i áº£nh...</span>
          <span class="error" *ngIf="uploadError()">{{ uploadError() }}</span>
          <img *ngIf="form.receiptImage && !uploading()" [src]="getImageUrl(form.receiptImage)" alt="Preview" class="preview" />
        </div>

        <div class="actions">
          <button type="submit" class="primary" [disabled]="uploading()">LÆ°u</button>
          <button type="button" (click)="closeModal()">Há»§y</button>
        </div>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </form>
    </div>
  </div>

  <!-- Approve modal -->
  <div class="modal-backdrop" *ngIf="showApproveModal()">
    <div class="modal approve-modal">
      <h3>XÃ¡c nháº­n duyá»‡t hÃ³a Ä‘Æ¡n</h3>
      <p class="hint" *ngIf="approvingInvoice()">
        HÃ³a Ä‘Æ¡n <strong>{{ approvingInvoice()!.invoiceNumber }}</strong> sáº½ cá»™ng
        <strong>{{ formatCurrency(approvingInvoice()!.amount) }}</strong> vÃ o vÃ­ phá»¥ huynh.
      </p>

      <label>áº¢nh xÃ¡c nháº­n duyá»‡t <span class="req">*</span>
        <input type="file" accept="image/*" (change)="handleApproveImageChange($event)" />
      </label>

      <div class="upload-status">
        <span *ngIf="approveUploading()">Äang táº£i áº£nh xÃ¡c nháº­n...</span>
        <span class="error" *ngIf="approveUploadError()">{{ approveUploadError() }}</span>
        <img
          *ngIf="approveImage && !approveUploading()"
          [src]="getImageUrl(approveImage)"
          alt="áº¢nh xÃ¡c nháº­n"
          class="preview" />
      </div>

      <div class="actions">
        <button
          type="button"
          class="primary"
          [disabled]="approveUploading() || !approveImage"
          (click)="confirmApprove()">
          Duyá»‡t hÃ³a Ä‘Æ¡n
        </button>
        <button type="button" (click)="closeApproveModal()">Há»§y</button>
      </div>
    </div>
  </div>

  <!-- Image lightbox -->
  <div class="modal-backdrop" *ngIf="modalImage()" (click)="closeImageModal()">
    <div class="image-modal">
      <span class="close" (click)="closeImageModal()">&times;</span>
      <img [src]="modalImage()" alt="Chá»©ng tá»«" />
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .tab-bar { display:flex; gap:6px; margin-bottom:16px; border-bottom:2px solid #e2e8f0; padding-bottom:8px; }
    .tab-bar button { background:#f1f5f9; border:1px solid #e2e8f0; padding:7px 16px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; }
    .tab-bar button.active { background:#2563eb; color:#fff; border-color:#2563eb; }
    .badge-count { display:inline-block; background:#ef4444; color:#fff; border-radius:999px; font-size:11px; padding:1px 6px; margin-left:4px; }

    /* Stats */
    .stats-bar { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:16px; }
    .stat-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; border-left:4px solid #94a3b8; }
    .stat-card.blue { border-left-color:#2563eb; background:#eff6ff; }
    .stat-card.orange { border-left-color:#ea580c; background:#fff7ed; }
    .stat-card.green { border-left-color:#16a34a; background:#f0fdf4; }
    .stat-card.yellow { border-left-color:#d97706; background:#fffbeb; }
    .stat-label { font-size:12px; color:#64748b; margin-bottom:4px; }
    .stat-value { font-size:16px; font-weight:700; color:#1e293b; }

    /* Filters */
    .filters-section { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px; }
    .filter-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
    .filter-row:last-child { margin-bottom:0; }
    .filter-input { flex:1; min-width:180px; }
    .date-wrap { display:flex; flex-direction:column; gap:2px; font-size:12px; color:#64748b; }
    .date-wrap input { padding:5px 8px; border:1px solid #cbd5e1; border-radius:4px; }
    .result-meta { font-size:13px; color:#64748b; margin-bottom:8px; }

    /* Table */
    .table-wrap { overflow-x:auto; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; width:100%; box-sizing:border-box; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; white-space:nowrap; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; vertical-align:middle; }
    thead { background:#f1f5f9; }
    .center { text-align:center; }
    .right { text-align:right; }

    /* Chips */
    .chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:500; }
    .chip-blue { background:#dbeafe; color:#1d4ed8; }
    .chip-orange { background:#ffedd5; color:#c2410c; }
    .muted-text { color:#94a3b8; font-size:12px; }

    /* Status */
    .status { padding:3px 8px; border-radius:12px; font-size:12px; font-weight:600; }
    .status.approved { background:#d1fae5; color:#065f46; }
    .status.pending-approval { background:#fef3c7; color:#92400e; }
    .status.rejected, .status.cancelled { background:#fee2e2; color:#991b1b; }

    /* Buttons */
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-size:13px; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px; }
    .ghost.success { border-color:#16a34a; color:#166534; }
    .ghost.danger { border-color:#dc2626; color:#b91c1c; }
    .ghost:hover { background:#f1f5f9; }

    /* Cells */
    .proof-stack { display:flex; gap:6px; align-items:center; }
    .receipt-thumb { width:56px; height:38px; object-fit:cover; border-radius:4px; cursor:pointer; border:1px solid #cbd5e1; }
    .approval-thumb { border-color:#16a34a; box-shadow:0 0 0 1px #bbf7d0 inset; }
    .actions-cell { text-align:right; white-space:nowrap; }
    .actions-cell button { margin-left:4px; }
    .empty-msg { color:#64748b; text-align:center; padding:32px 0; }

    /* Modal */
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:#fff; padding:24px; border-radius:10px; width:540px; max-height:92vh; overflow-y:auto; box-shadow:0 8px 32px rgba(15,23,42,.2); }
    .approve-modal { width:440px; }
    .modal h3 { margin:0 0 16px; font-size:16px; color:#1e293b; }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .modal label { font-size:13px; color:#374151; display:flex; flex-direction:column; gap:4px; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .req { color:#ef4444; }

    /* Parent info */
    .parent-info-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:8px 12px; font-size:13px; }
    .parent-info-label { color:#0284c7; font-size:12px; margin-right:6px; }
    .parent-info-phone { color:#64748b; }

    /* Readonly sale field */
    .readonly-field { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:4px; padding:7px 10px; font-size:13px; color:#374151; }

    /* Misc */
    .hint { margin:0; color:#64748b; font-size:12px; }
    .error { color:#dc2626; font-size:13px; }
    .upload-status { display:flex; flex-direction:column; gap:6px; font-size:13px; }
    .preview { width:120px; height:80px; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1; }
    .actions { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }

    /* Image lightbox */
    .image-modal { position:relative; max-width:90%; max-height:90%; }
    .image-modal img { max-width:100%; max-height:90vh; border-radius:8px; }
    .close { position:absolute; top:-40px; right:0; color:white; font-size:30px; cursor:pointer; }

    /* Top-up tab */
    .topup-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .topup-header h3 { margin:0; font-size:15px; color:#1e293b; }
  `]
})
export class InvoicesComponent {
  items = signal<InvoiceItem[]>([]);
  students = signal<StudentItem[]>([]);
  sales = signal<UserItem[]>([]);

  // Filter signals
  keyword = signal('');
  parentFilter = signal('');
  saleFilter = signal('');
  classTypeFilter = signal('');
  statusFilter = signal('');
  dateFrom = signal('');
  dateTo = signal('');

  activeTab: 'invoices' | 'topups' = 'invoices';
  showModal = signal(false);
  showApproveModal = signal(false);
  modalImage = signal('');
  error = signal('');
  uploadError = signal('');
  uploading = signal(false);
  approveUploadError = signal('');
  approveUploading = signal(false);
  form: InvoiceForm = this.blankForm();
  approveImage = '';

  canDeleteInvoices = false;
  canApproveInvoices = false;
  isSale = false;
  currentUserId = '';
  currentUserName = '';
  editingInvoice: InvoiceItem | null = null;
  approvingInvoice = signal<InvoiceItem | null>(null);

  pendingTopUps = signal<any[]>([]);
  loadingTopUps = signal(false);

  constructor(
    private invoiceService: InvoiceService,
    private studentService: StudentService,
    private userService: UserService,
    private auth: AuthService,
    private http: HttpClient,
  ) {
    void this.reload();
    void this.loadLookups();

    const user = this.auth.userSignal();
    const role = user?.role;
    this.canDeleteInvoices = role === 'DIRECTOR';
    this.canApproveInvoices = role === 'DIRECTOR' || role === 'ACCOUNTING';
    this.isSale = role === 'SALE';
    this.currentUserId = user?.sub || '';
    this.currentUserName = user?.fullName || '';

    if (this.canApproveInvoices) {
      void this.loadPendingTopUps();
    }
  }

  // Computed: selected student for parent info display in form
  get selectedStudent(): StudentItem | null {
    return this.students().find(s => s._id === this.form.studentId) ?? null;
  }

  // Computed: filtered invoice list
  filtered = computed(() => {
    let result = this.items();

    const kw = this.keyword().trim().toLowerCase();
    if (kw) {
      result = result.filter(i =>
        i.invoiceNumber.toLowerCase().includes(kw) ||
        i.studentId?.fullName?.toLowerCase().includes(kw)
      );
    }

    const parentKw = this.parentFilter().trim().toLowerCase();
    if (parentKw) {
      result = result.filter(i =>
        i.studentId?.parentName?.toLowerCase().includes(parentKw) ||
        i.studentId?.parentPhone?.toLowerCase().includes(parentKw)
      );
    }

    const saleKw = this.saleFilter().trim().toLowerCase();
    if (saleKw) {
      result = result.filter(i =>
        i.saleId?.fullName?.toLowerCase().includes(saleKw)
      );
    }

    const ct = this.classTypeFilter();
    if (ct) {
      result = result.filter(i => i.classType === ct);
    }

    const st = this.statusFilter();
    if (st) {
      result = result.filter(i => i.status === st);
    }

    const from = this.dateFrom();
    if (from) {
      const fromDate = new Date(from);
      result = result.filter(i => i.paymentDate && new Date(i.paymentDate) >= fromDate);
    }

    const to = this.dateTo();
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(i => i.paymentDate && new Date(i.paymentDate) <= toDate);
    }

    return result;
  });

  // Computed: summary stats based on filtered list
  summary = computed(() => {
    const data = this.filtered();
    return {
      total: data.length,
      onlineAmount: data
        .filter(i => i.classType === 'ONLINE')
        .reduce((s, i) => s + i.amount, 0),
      offlineAmount: data
        .filter(i => i.classType === 'OFFLINE')
        .reduce((s, i) => s + i.amount, 0),
      approvedAmount: data
        .filter(i => i.status === 'APPROVED' || i.status === 'PAID')
        .reduce((s, i) => s + i.amount, 0),
      pendingCount: data.filter(i => i.status === 'PENDING_APPROVAL').length,
    };
  });

  hasActiveFilters = computed(() =>
    !!this.keyword() || !!this.parentFilter() || !!this.saleFilter() ||
    !!this.classTypeFilter() || !!this.statusFilter() ||
    !!this.dateFrom() || !!this.dateTo()
  );

  clearFilters(): void {
    this.keyword.set('');
    this.parentFilter.set('');
    this.saleFilter.set('');
    this.classTypeFilter.set('');
    this.statusFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
  }

  async reload(): Promise<void> {
    const data = await this.invoiceService.list();
    this.items.set(data);
  }

  async loadLookups(): Promise<void> {
    const [studs, salesList] = await Promise.all([
      this.studentService.list(),
      this.userService.listSales(),
    ]);
    this.students.set(studs);
    this.sales.set(salesList);
  }

  onStudentChange(): void {
    // parent info auto-shows via selectedStudent getter
  }

  openModal(): void {
    this.editingInvoice = null;
    this.form = this.blankForm();
    // Pre-fill sale for SALE role
    if (this.isSale) {
      this.form.saleId = this.currentUserId;
    }
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  edit(invoice: InvoiceItem): void {
    this.editingInvoice = invoice;
    this.form = {
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId._id,
      classType: (invoice.classType as 'ONLINE' | 'OFFLINE') || '',
      saleId: invoice.saleId?._id || '',
      sessions: invoice.sessions || 0,
      amount: invoice.amount,
      paymentDate: invoice.paymentDate.split('T')[0],
      description: invoice.description || '',
      receiptImage: invoice.receiptImage || '',
    };
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  async submit(): Promise<void> {
    if (!this.form.classType) {
      this.error.set('Vui lÃ²ng chá»n loáº¡i lá»›p há»c (Online hoáº·c Offline)');
      return;
    }

    const payload: InvoiceUpsertPayload = {
      invoiceNumber: this.form.invoiceNumber.trim(),
      studentId: this.form.studentId,
      classType: this.form.classType,
      amount: Number(this.form.amount),
      paymentDate: this.form.paymentDate,
    };

    if (this.form.sessions > 0) payload.sessions = Number(this.form.sessions);
    if (this.form.saleId) payload.saleId = this.form.saleId;
    if (this.form.receiptImage) payload.receiptImage = this.form.receiptImage.trim();
    if (this.form.description) payload.description = this.form.description.trim();

    const result = this.editingInvoice
      ? await this.invoiceService.update(this.editingInvoice._id, payload)
      : await this.invoiceService.create(payload);

    if (!result.ok) {
      this.error.set(result.message || (this.editingInvoice ? 'KhÃ´ng thá»ƒ cáº­p nháº­t hÃ³a Ä‘Æ¡n' : 'KhÃ´ng thá»ƒ táº¡o hÃ³a Ä‘Æ¡n'));
      return;
    }

    this.closeModal();
    await this.reload();
  }

    openApproveModal(invoice: InvoiceItem): void {
    this.approvingInvoice.set(invoice);
    this.approveImage = '';
    this.approveUploadError.set('');
    this.approveUploading.set(false);
    this.showApproveModal.set(true);
  }

  closeApproveModal(): void {
    this.showApproveModal.set(false);
    this.approvingInvoice.set(null);
    this.approveImage = '';
    this.approveUploadError.set('');
    this.approveUploading.set(false);
  }

  async handleApproveImageChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.approveUploadError.set('');
    this.approveUploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.approveUploading.set(false);

    if (!result.ok || !result.url) {
      this.approveUploadError.set(result.message || 'Tai anh xac nhan that bai');
      return;
    }

    this.approveImage = result.url;
  }

  async confirmApprove(): Promise<void> {
    const invoice = this.approvingInvoice();
    if (!invoice) return;

    if (!this.approveImage) {
      this.approveUploadError.set('Vui long tai anh xac nhan truoc khi duyet');
      return;
    }

    if (!confirm(`Duyet hoa don ${invoice.invoiceNumber}? Vi phu huynh se duoc cong ${this.formatCurrency(invoice.amount)}.`)) return;

    const result = await this.invoiceService.approve(invoice._id, 'APPROVE', undefined, this.approveImage);
    if (!result.ok) {
      this.approveUploadError.set(result.message || 'Khong the duyet hoa don');
      return;
    }

    this.closeApproveModal();
    await this.reload();
  }
  async reject(invoice: InvoiceItem): Promise<void> {
    const reason = prompt(`LÃ½ do tá»« chá»‘i hÃ³a Ä‘Æ¡n ${invoice.invoiceNumber}:`, '');
    if (reason === null) return;

    const result = await this.invoiceService.approve(invoice._id, 'REJECT', reason.trim() || undefined);
    if (!result.ok) {
      alert(result.message || 'KhÃ´ng thá»ƒ tá»« chá»‘i hÃ³a Ä‘Æ¡n');
      return;
    }
    await this.reload();
  }

  async remove(invoice: InvoiceItem): Promise<void> {
    if (!confirm(`XÃ³a hÃ³a Ä‘Æ¡n ${invoice.invoiceNumber}?`)) return;

    const result = await this.invoiceService.remove(invoice._id);
    if (!result.ok) {
      alert(result.message || 'KhÃ´ng thá»ƒ xÃ³a hÃ³a Ä‘Æ¡n');
      return;
    }
    await this.reload();
  }

  async handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set('');
    this.uploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.uploading.set(false);

    if (!result.ok || !result.url) {
      this.uploadError.set(result.message || 'Táº£i áº£nh tháº¥t báº¡i');
      return;
    }
    this.form.receiptImage = result.url;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'â€”';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }

  getStatusText(status: InvoiceStatus | string): string {
    const map: Record<string, string> = {
      PENDING_APPROVAL: 'Chá» duyá»‡t',
      APPROVED: 'ÄÃ£ duyá»‡t',
      REJECTED: 'Tá»« chá»‘i',
      CANCELLED: 'ÄÃ£ há»§y',
      PAID: 'ÄÃ£ thanh toÃ¡n',
      PENDING: 'Chá» thanh toÃ¡n',
    };
    return map[status] || status;
  }

  getStatusClass(status: InvoiceStatus | string): string {
    const map: Record<string, string> = {
      PENDING_APPROVAL: 'pending-approval',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      PAID: 'approved',
      PENDING: 'pending-approval',
    };
    return map[status] || 'pending-approval';
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('http')) return imagePath;
    return `${environment.apiBase}${imagePath}`;
  }

  showImageModal(imageUrl: string): void {
    this.modalImage.set(imageUrl);
  }

  closeImageModal(): void {
    this.modalImage.set('');
  }

  private blankForm(): InvoiceForm {
    return {
      invoiceNumber: '',
      studentId: '',
      classType: '',
      saleId: '',
      sessions: 0,
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      description: '',
      receiptImage: '',
    };
  }

  // â”€â”€ Pending top-up management â”€â”€

  async loadPendingTopUps(): Promise<void> {
    this.loadingTopUps.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiBase}/wallets/top-up/pending`, { withCredentials: true }),
      );
      this.pendingTopUps.set(data || []);
    } catch {
      this.pendingTopUps.set([]);
    } finally {
      this.loadingTopUps.set(false);
    }
  }

  async approveTopUpRequest(req: any): Promise<void> {
    const isBankTransfer = req.paymentMethod === 'BANK_TRANSFER';
    if (isBankTransfer && !req.receiptImageUrl) {
      alert('YÃªu cáº§u chuyá»ƒn khoáº£n thiáº¿u áº£nh biÃªn lai, khÃ´ng thá»ƒ duyá»‡t.');
      return;
    }

    let notes = '';
    if (isBankTransfer) {
      const input = prompt('MÃ£ sao kÃª / ghi chÃº xÃ¡c nháº­n (tuá»³ chá»n):');
      if (input === null) return;
      notes = input;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/wallets/top-up/${req._id}/approve`,
          {
            bankMatched: isBankTransfer ? true : undefined,
            bankStatementRef: notes.trim() || undefined,
            accountingNotes: notes.trim() || undefined,
          },
          { withCredentials: true },
        ),
      );
      alert(`ÄÃ£ duyá»‡t yÃªu cáº§u náº¡p ${this.formatCurrency(req.amount)} cho ${req.userId?.fullName || ''}. VÃ­ phá»¥ huynh Ä‘Ã£ Ä‘Æ°á»£c cá»™ng tiá»n.`);
      await this.loadPendingTopUps();
    } catch (err: any) {
      alert(err?.error?.message || 'Duyá»‡t tháº¥t báº¡i');
    }
  }

  async rejectTopUpRequest(req: any): Promise<void> {
    const reason = prompt(`LÃ½ do tá»« chá»‘i yÃªu cáº§u náº¡p tiá»n cá»§a ${req.userId?.fullName || ''}:`);
    if (reason === null) return;

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/wallets/top-up/${req._id}/reject`,
          { reason: reason.trim() || 'KhÃ´ng duyá»‡t' },
          { withCredentials: true },
        ),
      );
      alert('ÄÃ£ tá»« chá»‘i yÃªu cáº§u náº¡p tiá»n.');
      await this.loadPendingTopUps();
    } catch (err: any) {
      alert(err?.error?.message || 'Tá»« chá»‘i tháº¥t báº¡i');
    }
  }

  methodLabel(method: string): string {
    const map: Record<string, string> = {
      BANK_TRANSFER: 'Chuyá»ƒn khoáº£n',
      CASH: 'Tiá»n máº·t',
      MOMO: 'MoMo',
      SYSTEM: 'Há»‡ thá»‘ng',
    };
    return map[method] || method;
  }
}

