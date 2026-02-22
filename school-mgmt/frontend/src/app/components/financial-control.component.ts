import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  FinancialControlService,
  BankAccount, BankTransaction, Fund, FundTransaction,
  FinancialOverview, CashFlowData, ProfitAndLoss, FinancialDashboard,
  FinancialAlertsResponse, FinancialAlert,
} from '../services/financial-control.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

const FUND_TYPE_LABELS: Record<string, string> = {
  RESERVE: 'Quá»¹ dá»± phÃ²ng',
  PETTY_CASH: 'Quá»¹ tiá»n máº·t',
  MARKETING: 'Quá»¹ marketing',
  TRAINING: 'Quá»¹ Ä‘Ã o táº¡o',
  BONUS: 'Quá»¹ thÆ°á»Ÿng',
  OTHER: 'Quá»¹ khÃ¡c',
};

const TX_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Náº¡p vÃ o',
  WITHDRAWAL: 'RÃºt ra',
  TRANSFER_IN: 'Chuyá»ƒn Ä‘áº¿n',
  TRANSFER_OUT: 'Chuyá»ƒn Ä‘i',
  INTEREST: 'LÃ£i suáº¥t',
  FEE: 'PhÃ­ dá»‹ch vá»¥',
  ADJUSTMENT: 'Äiá»u chá»‰nh',
  WITHDRAW: 'RÃºt tá»« quá»¹',
};

const CATEGORY_LABELS: Record<string, string> = {
  TUITION_INCOME: 'Thu há»c phÃ­',
  PAYROLL: 'Chi lÆ°Æ¡ng',
  EXPENSE: 'Chi phÃ­ VH',
  RESERVE_FUND: 'Quá»¹ dá»± phÃ²ng',
  PETTY_CASH: 'Tiá»n máº·t',
  COMMISSION: 'Hoa há»“ng',
  REFUND: 'HoÃ n tiá»n',
  LOAN_DISBURSEMENT: 'Giáº£i ngÃ¢n vá»‘n vay',
  LOAN_REPAYMENT: 'Tráº£ ná»£ vay',
  OTHER: 'KhÃ¡c',
};

const EXPENSE_CAT_LABELS: Record<string, string> = {
  RENT: 'ThuÃª máº·t báº±ng',
  UTILITIES: 'Äiá»‡n nÆ°á»›c Internet',
  SUPPLIES: 'VÄƒn phÃ²ng pháº©m',
  MARKETING: 'Marketing',
  MAINTENANCE: 'Sá»­a chá»¯a',
  SALARY_BONUS: 'ThÆ°á»Ÿng/Phá»¥ cáº¥p',
  TRAINING: 'ÄÃ o táº¡o',
  TRANSPORT: 'Äi láº¡i',
  MEAL: 'Ä‚n uá»‘ng',
  ENTERTAINMENT: 'Tiáº¿p khÃ¡ch',
  OTHER: 'KhÃ¡c',
};

@Component({
  selector: 'app-financial-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>ðŸ¦ Kiá»ƒm soÃ¡t TÃ i chÃ­nh</h2>
      <p>Quáº£n lÃ½ sá»‘ dÆ° ngÃ¢n hÃ ng, quá»¹, dÃ²ng tiá»n vÃ  báº£ng cÃ¢n Ä‘á»‘i.</p>
    </div>
    <div class="header-filters">
      <input type="date" [(ngModel)]="startDate" placeholder="Tá»« ngÃ y" />
      <input type="date" [(ngModel)]="endDate" placeholder="Äáº¿n ngÃ y" />
      <button class="primary" (click)="reload()">Cáº­p nháº­t</button>
    </div>
  </header>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button *ngFor="let t of tabs" [class.active]="activeTab === t.key" (click)="activeTab = t.key; loadTab(t.key)">
      {{t.icon}} {{t.label}}
    </button>
  </div>

  <!-- â•â•â• TAB: Overview (Dashboard) â•â•â• -->
  <div *ngIf="activeTab === 'overview'" class="tab-content">
    <ng-container *ngIf="dashboard()">

      <!-- Section 1: Cash Position -->
      <div class="dash-section">
        <h4>TÃŒNH HÃŒNH TIá»€N Máº¶T</h4>
        <div class="overview-grid">
          <div class="ov-card bank">
            <div class="ov-icon">ðŸ¦</div>
            <div class="ov-value">{{dashboard()!.cashPosition.bankBalance | number}}Ä‘</div>
            <div class="ov-label">Sá»‘ dÆ° NgÃ¢n hÃ ng ({{dashboard()!.cashPosition.bankAccountCount}} TK)</div>
          </div>
          <div class="ov-card fund">
            <div class="ov-icon">ðŸ“¢</div>
            <div class="ov-value">{{dashboard()!.cashPosition.marketingFund | number}}Ä‘</div>
            <div class="ov-label">Quá»¹ Marketing ({{dashboard()!.cashPosition.marketingFundCount}} quá»¹)</div>
          </div>
          <div class="ov-card fund">
            <div class="ov-icon">ðŸ›ï¸</div>
            <div class="ov-value">{{dashboard()!.cashPosition.fundBalance | number}}Ä‘</div>
            <div class="ov-label">Tá»•ng cÃ¡c Quá»¹ ({{dashboard()!.cashPosition.fundCount}} quá»¹)</div>
          </div>
          <div class="ov-card profit">
            <div class="ov-icon">ðŸ’µ</div>
            <div class="ov-value">{{dashboard()!.cashPosition.availableCash | number}}Ä‘</div>
            <div class="ov-label">Tá»•ng tiá»n kháº£ dá»¥ng (NH + Quá»¹)</div>
          </div>
        </div>
      </div>

      <!-- Section 2: Obligations & Reserve -->
      <div class="dash-section">
        <h4>NGHÄ¨A Vá»¤ THANH TOÃN & Dá»° PHÃ’NG</h4>
        <div class="overview-grid">
          <div class="ov-card outflow">
            <div class="ov-icon">ðŸ“‹</div>
            <div class="ov-value">{{dashboard()!.obligations.totalPayable14Days | number}}Ä‘</div>
            <div class="ov-label">Pháº£i tráº£ trong 14 ngÃ y tá»›i</div>
            <div class="ov-detail" *ngIf="dashboard()!.obligations.totalPayable14Days > 0">
              <small>LÆ°Æ¡ng: {{dashboard()!.obligations.payrollPayable | number}}Ä‘ ({{dashboard()!.obligations.payrollPayableCount}})</small><br/>
              <small>Chi phÃ­: {{dashboard()!.obligations.expensePayable | number}}Ä‘ ({{dashboard()!.obligations.expensePayableCount}})</small><br/>
              <small>ÄÆ¡n hÃ ng: {{dashboard()!.obligations.orderPayable | number}}Ä‘ ({{dashboard()!.obligations.orderPayableCount}})</small>
            </div>
          </div>
          <div class="ov-card" [class.loss]="!dashboard()!.obligations.reserveHealthy" [class.profit]="dashboard()!.obligations.reserveHealthy">
            <div class="ov-icon">ðŸ›¡ï¸</div>
            <div class="ov-value">{{dashboard()!.obligations.operatingReserve3Months | number}}Ä‘</div>
            <div class="ov-label">Dá»± phÃ²ng hoáº¡t Ä‘á»™ng 3 thÃ¡ng cáº§n</div>
            <div class="ov-warning" *ngIf="!dashboard()!.obligations.reserveHealthy">
              âš ï¸ Tiá»n kháº£ dá»¥ng chÆ°a Ä‘á»§ dá»± phÃ²ng 3 thÃ¡ng!
            </div>
          </div>
          <div class="ov-card" [class.loss]="dashboard()!.obligations.runway < 3" [class.profit]="dashboard()!.obligations.runway >= 3">
            <div class="ov-icon">â±ï¸</div>
            <div class="ov-value">{{dashboard()!.obligations.runway}} thÃ¡ng</div>
            <div class="ov-label">Runway (hoáº¡t Ä‘á»™ng Ä‘Æ°á»£c bao lÃ¢u)</div>
          </div>
          <div class="ov-card" [class.profit]="dashboard()!.obligations.cashAfterObligations >= 0" [class.loss]="dashboard()!.obligations.cashAfterObligations < 0">
            <div class="ov-icon">ðŸ’°</div>
            <div class="ov-value">{{dashboard()!.obligations.cashAfterObligations | number}}Ä‘</div>
            <div class="ov-label">Tiá»n cÃ²n sau nghÄ©a vá»¥ 14 ngÃ y</div>
          </div>
        </div>
      </div>

      <!-- Section 3: Deferred Revenue -->
      <div class="dash-section">
        <h4>DOANH THU CHá»œ Xá»¬ LÃ & Ná»¢ PHá»¤ HUYNH</h4>
        <div class="overview-grid">
          <div class="ov-card inflow">
            <div class="ov-icon">ðŸ‘›</div>
            <div class="ov-value">{{dashboard()!.deferredRevenue.walletBalance | number}}Ä‘</div>
            <div class="ov-label">VÃ­ Phá»¥ huynh (sá»­ dá»¥ng Ä‘Æ°á»£c, chÆ°a lÃ  DT)</div>
            <div class="ov-detail"><small>{{dashboard()!.deferredRevenue.walletCount}} vÃ­</small></div>
          </div>
          <div class="ov-card inflow">
            <div class="ov-icon">ðŸ“„</div>
            <div class="ov-value">{{dashboard()!.deferredRevenue.pendingInvoiceAmount | number}}Ä‘</div>
            <div class="ov-label">HÃ³a Ä‘Æ¡n chá» duyá»‡t (tiá»n sáº¯p vÃ o)</div>
            <div class="ov-detail"><small>{{dashboard()!.deferredRevenue.pendingInvoiceCount}} hÃ³a Ä‘Æ¡n</small></div>
          </div>
        </div>
      </div>

      <!-- Section 4: Debt Position (Loans) -->
      <div class="dash-section" *ngIf="dashboard()!.debtPosition">
        <h4>TÃŒNH HÃŒNH Ná»¢ VAY</h4>
        <div class="overview-grid">
          <div class="ov-card loss">
            <div class="ov-icon">&#128178;</div>
            <div class="ov-value">{{dashboard()!.debtPosition!.totalDebt | number}}Ä‘</div>
            <div class="ov-label">Tá»•ng dÆ° ná»£ vay ({{dashboard()!.debtPosition!.activeLoanCount}} khoáº£n)</div>
          </div>
          <div class="ov-card outflow">
            <div class="ov-icon">&#128197;</div>
            <div class="ov-value">{{dashboard()!.debtPosition!.loanPayable | number}}Ä‘</div>
            <div class="ov-label">Pháº£i tráº£ ná»£ vay 30 ngÃ y tá»›i ({{dashboard()!.debtPosition!.loanPayableCount}} ká»³)</div>
          </div>
        </div>
      </div>

      <!-- Section 5: Accounting Metrics -->
      <div class="dash-section">
        <h4>CHá»ˆ Sá» Káº¾ TOÃN</h4>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Burn Rate / thÃ¡ng</div>
            <div class="metric-value">{{dashboard()!.metrics.burnRate | number}}Ä‘</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Runway</div>
            <div class="metric-value" [class.amount-red]="dashboard()!.metrics.runway < 3" [class.amount-green]="dashboard()!.metrics.runway >= 6">
              {{dashboard()!.metrics.runway}} thÃ¡ng
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Current Ratio</div>
            <div class="metric-value" [class.amount-red]="dashboard()!.metrics.currentRatio < 1" [class.amount-green]="dashboard()!.metrics.currentRatio >= 1.5">
              {{dashboard()!.metrics.currentRatio}}
            </div>
            <div class="metric-hint">&#8805; 1.5 = tá»‘t</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">BiÃªn lá»£i nhuáº­n gá»™p</div>
            <div class="metric-value" [class.amount-green]="dashboard()!.metrics.grossMargin > 0" [class.amount-red]="dashboard()!.metrics.grossMargin <= 0">
              {{dashboard()!.metrics.grossMargin}}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">BiÃªn lá»£i nhuáº­n rÃ²ng</div>
            <div class="metric-value" [class.amount-green]="dashboard()!.metrics.netMargin > 0" [class.amount-red]="dashboard()!.metrics.netMargin <= 0">
              {{dashboard()!.metrics.netMargin}}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">TÄƒng trÆ°á»Ÿng DT thÃ¡ng</div>
            <div class="metric-value" [class.amount-green]="dashboard()!.metrics.revenueGrowth > 0" [class.amount-red]="dashboard()!.metrics.revenueGrowth < 0">
              {{dashboard()!.metrics.revenueGrowth > 0 ? '+' : ''}}{{dashboard()!.metrics.revenueGrowth}}%
            </div>
            <div class="metric-hint">{{dashboard()!.metrics.lastMonthRevenue | number}}Ä‘ â†’ {{dashboard()!.metrics.thisMonthRevenue | number}}Ä‘</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Pháº£i thu (AR)</div>
            <div class="metric-value">{{dashboard()!.metrics.accountsReceivable | number}}Ä‘</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Pháº£i tráº£ (AP)</div>
            <div class="metric-value">{{dashboard()!.metrics.accountsPayable | number}}Ä‘</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Doanh thu tráº£ trÆ°á»›c (Ná»£ PH)</div>
            <div class="metric-value">{{dashboard()!.metrics.deferredRevenue | number}}Ä‘</div>
          </div>
        </div>
      </div>

      <!-- Fund Warnings -->
      <div class="warning-section" *ngIf="dashboard()!.fundWarnings.length">
        <h4>âš ï¸ Cáº£nh bÃ¡o Quá»¹ dÆ°á»›i má»©c tá»‘i thiá»ƒu</h4>
        <div class="warning-list">
          <div class="warning-item" *ngFor="let w of dashboard()!.fundWarnings">
            <strong>{{w.name}}</strong> ({{w.fundCode}}):
            Hiá»‡n cÃ³ <span class="amount-red">{{w.currentBalance | number}}Ä‘</span>,
            Tá»‘i thiá»ƒu <span class="amount-blue">{{w.minimumBalance | number}}Ä‘</span>,
            Thiáº¿u <span class="amount-red">{{w.deficit | number}}Ä‘</span>
          </div>
        </div>
      </div>

    </ng-container>
    <p class="empty-text" *ngIf="!dashboard()">Äang táº£i dá»¯ liá»‡u dashboard...</p>
  </div>

  <!-- â•â•â• TAB: Bank Accounts â•â•â• -->
  <div *ngIf="activeTab === 'bank'" class="tab-content">
    <div class="section-header">
      <h3>TÃ i khoáº£n NgÃ¢n hÃ ng</h3>
      <button class="primary" (click)="openBankAccountModal()" *ngIf="isDirector()">+ ThÃªm TK ngÃ¢n hÃ ng</button>
    </div>

    <div class="card-grid" *ngIf="bankAccounts().length">
      <div class="bank-card" *ngFor="let ba of bankAccounts()" [class.primary-account]="ba.isPrimary" (click)="selectBankAccount(ba)">
        <div class="bank-name">{{ba.bankName}} {{ba.isPrimary ? 'â­' : ''}}</div>
        <div class="account-num">{{ba.accountNumber}}</div>
        <div class="bank-balance">{{ba.currentBalance | number}}Ä‘</div>
        <div class="bank-holder" *ngIf="ba.accountHolder">{{ba.accountHolder}}</div>
        <span class="badge" [class.active]="ba.status === 'ACTIVE'" [class.inactive]="ba.status !== 'ACTIVE'">{{ba.status}}</span>
      </div>
    </div>
    <p class="empty-text" *ngIf="!bankAccounts().length">ChÆ°a cÃ³ tÃ i khoáº£n ngÃ¢n hÃ ng nÃ o.</p>

    <!-- Bank Transactions -->
    <div class="section-header mt">
      <h3>Giao dá»‹ch ngÃ¢n hÃ ng {{selectedBankAccount() ? 'â€” ' + selectedBankAccount()!.bankName : ''}}</h3>
      <button class="primary" (click)="openBankTxModal()">+ Ghi nháº­n giao dá»‹ch</button>
    </div>
    <div class="filters">
      <select [(ngModel)]="bankTxType" (ngModelChange)="loadBankTransactions()">
        <option value="">Táº¥t cáº£ loáº¡i</option>
        <option value="DEPOSIT">Náº¡p vÃ o</option>
        <option value="WITHDRAWAL">RÃºt ra</option>
        <option value="TRANSFER_IN">Chuyá»ƒn Ä‘áº¿n</option>
        <option value="TRANSFER_OUT">Chuyá»ƒn Ä‘i</option>
        <option value="INTEREST">LÃ£i suáº¥t</option>
        <option value="FEE">PhÃ­ dá»‹ch vá»¥</option>
        <option value="ADJUSTMENT">Äiá»u chá»‰nh</option>
      </select>
      <input placeholder="TÃ¬m kiáº¿m..." [(ngModel)]="bankTxKeyword" (ngModelChange)="loadBankTransactions()" />
    </div>

    <table class="data" *ngIf="bankTransactions().length">
      <thead><tr>
        <th>MÃ£</th><th>NgÃ y</th><th>Loáº¡i</th><th>Danh má»¥c</th><th>Sá»‘ tiá»n</th>
        <th>TrÆ°á»›c</th><th>Sau</th><th>MÃ´ táº£</th><th>NgÆ°á»i ghi</th><th>Äá»‘i soÃ¡t</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let tx of bankTransactions()">
          <td><code>{{tx.transactionCode}}</code></td>
          <td>{{tx.transactionDate | date:'dd/MM/yyyy'}}</td>
          <td>{{txTypeLabel(tx.type)}}</td>
          <td>{{categoryLabel(tx.category)}}</td>
          <td class="right" [class.amount-green]="isInflow(tx.type)" [class.amount-red]="!isInflow(tx.type)">
            {{isInflow(tx.type) ? '+' : '-'}}{{tx.amount | number}}Ä‘
          </td>
          <td class="right">{{tx.balanceBefore | number}}Ä‘</td>
          <td class="right">{{tx.balanceAfter | number}}Ä‘</td>
          <td>{{tx.description || '-'}}</td>
          <td>{{tx.recordedByName}}</td>
          <td>
            <span *ngIf="tx.isReconciled" class="badge reconciled">âœ“</span>
            <button *ngIf="!tx.isReconciled" class="btn-sm" (click)="reconcile(tx._id)">Äá»‘i soÃ¡t</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="empty-text" *ngIf="!bankTransactions().length">ChÆ°a cÃ³ giao dá»‹ch nÃ o.</p>
  </div>

  <!-- â•â•â• TAB: Funds â•â•â• -->
  <div *ngIf="activeTab === 'funds'" class="tab-content">
    <div class="section-header">
      <h3>Quáº£n lÃ½ Quá»¹</h3>
      <button class="primary" (click)="openFundModal()" *ngIf="isDirector()">+ Táº¡o quá»¹ má»›i</button>
    </div>

    <div class="card-grid" *ngIf="funds().length">
      <div class="fund-card" *ngFor="let f of funds()" [class.warning]="f.currentBalance < f.minimumBalance" (click)="selectFund(f)">
        <div class="fund-type">{{fundTypeLabel(f.fundType)}}</div>
        <div class="fund-name">{{f.name}} <code>{{f.fundCode}}</code></div>
        <div class="fund-balance">{{f.currentBalance | number}}Ä‘</div>
        <div class="fund-meta">
          <span>Tá»‘i thiá»ƒu: {{f.minimumBalance | number}}Ä‘</span>
          <span>ÄÃ­ch: {{f.targetBalance | number}}Ä‘</span>
        </div>
        <div class="fund-progress" *ngIf="f.targetBalance > 0">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="Math.min((f.currentBalance / f.targetBalance) * 100, 100)"></div>
          </div>
          <small>{{Math.round((f.currentBalance / f.targetBalance) * 100)}}%</small>
        </div>
        <div class="fund-warning" *ngIf="f.currentBalance < f.minimumBalance">
          âš ï¸ DÆ°á»›i má»©c tá»‘i thiá»ƒu (thiáº¿u {{(f.minimumBalance - f.currentBalance) | number}}Ä‘)
        </div>
        <span class="badge" [class.active]="f.status === 'ACTIVE'">{{f.status}}</span>
      </div>
    </div>
    <p class="empty-text" *ngIf="!funds().length">ChÆ°a cÃ³ quá»¹ nÃ o.</p>

    <!-- Fund Transactions -->
    <div class="section-header mt" *ngIf="selectedFund()">
      <h3>Giao dá»‹ch quá»¹ â€” {{selectedFund()!.name}}</h3>
      <button class="primary" (click)="openFundTxModal()">+ Náº¡p/RÃºt quá»¹</button>
    </div>

    <table class="data" *ngIf="fundTransactions().length">
      <thead><tr>
        <th>MÃ£</th><th>NgÃ y</th><th>Loáº¡i</th><th>Sá»‘ tiá»n</th>
        <th>TrÆ°á»›c</th><th>Sau</th><th>MÃ´ táº£</th><th>NgÆ°á»i thá»±c hiá»‡n</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let ft of fundTransactions()">
          <td><code>{{ft.transactionCode}}</code></td>
          <td>{{ft.transactionDate | date:'dd/MM/yyyy'}}</td>
          <td>{{txTypeLabel(ft.type)}}</td>
          <td class="right" [class.amount-green]="ft.type === 'DEPOSIT'" [class.amount-red]="ft.type === 'WITHDRAW'">
            {{ft.type === 'DEPOSIT' ? '+' : '-'}}{{ft.amount | number}}Ä‘
          </td>
          <td class="right">{{ft.balanceBefore | number}}Ä‘</td>
          <td class="right">{{ft.balanceAfter | number}}Ä‘</td>
          <td>{{ft.description || '-'}}</td>
          <td>{{ft.performedByName}}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- â•â•â• TAB: Cash Flow â•â•â• -->
  <div *ngIf="activeTab === 'cashflow'" class="tab-content">
    <div class="section-header">
      <h3>DÃ²ng tiá»n</h3>
      <div class="filters inline">
        <select [(ngModel)]="cashFlowGroupBy" (ngModelChange)="loadCashFlow()">
          <option value="day">Theo ngÃ y</option>
          <option value="month">Theo thÃ¡ng</option>
        </select>
      </div>
    </div>

    <div class="cashflow-summary" *ngIf="cashFlow()">
      <div class="cf-card inflow">
        <div>Tá»•ng dÃ²ng tiá»n vÃ o</div>
        <div class="cf-value amount-green">{{cashFlow()!.totalInflow | number}}Ä‘</div>
      </div>
      <div class="cf-card outflow">
        <div>Tá»•ng dÃ²ng tiá»n ra</div>
        <div class="cf-value amount-red">{{cashFlow()!.totalOutflow | number}}Ä‘</div>
      </div>
      <div class="cf-card net" [class.positive]="cashFlow()!.netCashFlow >= 0" [class.negative]="cashFlow()!.netCashFlow < 0">
        <div>DÃ²ng tiá»n rÃ²ng</div>
        <div class="cf-value">{{cashFlow()!.netCashFlow | number}}Ä‘</div>
      </div>
    </div>
    <p class="empty-text" *ngIf="cashFlow()?.basis">
      Basis: {{cashFlow()!.basis!.applied | uppercase}}.
      Session revenue vÃ  teacher cost chá»‰ lÃ  tham chiáº¿u accrual, khÃ´ng cá»™ng vÃ o tá»•ng cashflow.
    </p>
    <p class="empty-text" *ngIf="cashFlow()?.accrualReference">
      Tham chiáº¿u accrual: Doanh thu buá»•i há»c {{cashFlow()!.accrualReference!.sessionRevenue | number}}Ä‘,
      Chi phÃ­ giÃ¡o viÃªn {{cashFlow()!.accrualReference!.teacherCost | number}}Ä‘.
    </p>

    <table class="data" *ngIf="cashFlow()?.timeline?.length">
      <thead><tr>
        <th>Ká»³</th><th>HÃ³a Ä‘Æ¡n (vÃ o)</th><th>Doanh thu buá»•i há»c</th><th>Náº¡p vÃ­ (vÃ o)</th><th>Vá»‘n vay (vÃ o)</th>
        <th>LÆ°Æ¡ng GV (ra)</th><th>Chi phÃ­ VH (ra)</th><th>QC (ra)</th><th>Tráº£ ná»£ vay (ra)</th>
        <th>Tá»•ng vÃ o</th><th>Tá»•ng ra</th><th>RÃ²ng</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let t of cashFlow()!.timeline">
          <td><strong>{{t.date}}</strong></td>
          <td class="right amount-green">{{t.inflow.invoices | number}}Ä‘ <small>({{t.inflow.invoiceCount}})</small></td>
          <td class="right">{{t.inflow.sessionRevenue | number}}Ä‘ <small>({{t.inflow.sessionCount}})</small></td>
          <td class="right amount-green">{{t.inflow.walletTopUps | number}}Ä‘ <small>({{t.inflow.walletTopUpCount}})</small></td>
          <td class="right amount-green">{{t.inflow.loanDisbursements | number}}Ä‘ <small>({{t.inflow.loanDisbursementCount}})</small></td>
          <td class="right amount-red">{{t.outflow.payroll | number}}Ä‘ <small>({{t.outflow.payrollCount}})</small></td>
          <td class="right amount-red">{{t.outflow.expenses | number}}Ä‘ <small>({{t.outflow.expenseCount}})</small></td>
          <td class="right amount-red">{{t.outflow.adCost | number}}Ä‘ <small>({{t.outflow.adCostCount}})</small></td>
          <td class="right amount-red">{{t.outflow.loanRepayments | number}}Ä‘ <small>({{t.outflow.loanRepaymentCount}})</small></td>
          <td class="right amount-green"><strong>{{t.totalInflow | number}}Ä‘</strong></td>
          <td class="right amount-red"><strong>{{t.totalOutflow | number}}Ä‘</strong></td>
          <td class="right" [class.amount-green]="t.netCashFlow >= 0" [class.amount-red]="t.netCashFlow < 0">
            <strong>{{t.netCashFlow | number}}Ä‘</strong>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="empty-text" *ngIf="!cashFlow()?.timeline?.length">KhÃ´ng cÃ³ dá»¯ liá»‡u dÃ²ng tiá»n.</p>
  </div>

  <!-- â•â•â• TAB: P&L Report â•â•â• -->
  <div *ngIf="activeTab === 'pnl'" class="tab-content">
    <div class="section-header">
      <h3>P&L Report</h3>
      <div class="filters inline">
        <select [(ngModel)]="pnlBasis" (ngModelChange)="loadPnl()">
          <option value="cash">Cash basis</option>
          <option value="accrual">Accrual basis</option>
        </select>
      </div>
    </div>

    <div class="pnl-report" *ngIf="pnl()">
      <div class="pnl-section revenue">
        <h4>ðŸ“ˆ DOANH THU</h4>
        <div class="pnl-row">
          <span>Doanh thu tá»« buá»•i há»c (tham chiáº¿u accrual, {{pnl()!.revenue.sessionCount}} buá»•i):</span>
          <span class="amount-green">{{pnl()!.revenue.sessionRevenue | number}}Ä‘</span>
        </div>
        <div class="pnl-row" *ngFor="let entry of invoiceTypeEntries()">
          <span>HÃ³a Ä‘Æ¡n {{entry.key}} ({{entry.value.count}}):</span>
          <span class="amount-green">{{entry.value.amount | number}}Ä‘</span>
        </div>
        <div class="pnl-row total">
          <span>Tá»”NG DOANH THU ({{(pnl()!.basis?.selected || pnlBasis) | uppercase}}):</span>
          <span class="amount-green"><strong>{{pnl()!.revenue.total | number}}Ä‘</strong></span>
        </div>
      </div>

      <div class="pnl-section costs">
        <h4>ðŸ“‰ CHI PHÃ</h4>
        <div class="pnl-row">
          <span>Chi phÃ­ giÃ¡o viÃªn (tham chiáº¿u accrual):</span>
          <span class="amount-red">{{pnl()!.costs.teacherCost | number}}Ä‘</span>
        </div>
        <div class="pnl-row">
          <span>Payroll Ä‘Ã£ chi (GV + Staff):</span>
          <span class="amount-red">{{pnl()!.costs.payrollCost | number}}Ä‘</span>
        </div>
        <div class="pnl-row" *ngFor="let entry of expenseCatEntries()">
          <span>{{expenseCatLabel(entry.key)}} ({{entry.value.count}}):</span>
          <span class="amount-red">{{entry.value.amount | number}}Ä‘</span>
        </div>
        <div class="pnl-row" *ngFor="let entry of adCostPlatformEntries()">
          <span>Quáº£ng cÃ¡o {{entry.key}} ({{entry.value.count}}):</span>
          <span class="amount-red">{{entry.value.amount | number}}Ä‘</span>
        </div>
        <div class="pnl-row" *ngIf="pnl()!.costs.interestExpense">
          <span>Chi phÃ­ lÃ£i vay:</span>
          <span class="amount-red">{{pnl()!.costs.interestExpense | number}}Ä‘</span>
        </div>
        <div class="pnl-row total">
          <span>Tá»”NG CHI PHÃ ({{(pnl()!.basis?.selected || pnlBasis) | uppercase}}):</span>
          <span class="amount-red"><strong>{{pnl()!.costs.totalCosts | number}}Ä‘</strong></span>
        </div>
      </div>

      <div class="pnl-section summary">
        <div class="pnl-row">
          <span>Lá»£i nhuáº­n gá»™p:</span>
          <span [class.amount-green]="pnl()!.summary.grossProfit >= 0"
                [class.amount-red]="pnl()!.summary.grossProfit < 0">
            {{pnl()!.summary.grossProfit | number}}Ä‘ ({{pnl()!.summary.grossMargin}}%)
          </span>
        </div>
        <div class="pnl-row highlight">
          <span><strong>Lá»¢I NHUáº¬N RÃ’NG:</strong></span>
          <span [class.amount-green]="pnl()!.summary.netProfit >= 0"
                [class.amount-red]="pnl()!.summary.netProfit < 0">
            <strong>{{pnl()!.summary.netProfit | number}}Ä‘ ({{pnl()!.summary.netMargin}}%)</strong>
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- â•â•â• TAB: Reconciliation â•â•â• -->
  <div *ngIf="activeTab === 'reconciliation'" class="tab-content">
    <h3>Äá»‘i soÃ¡t TÃ i chÃ­nh</h3>

    <div class="recon-grid" *ngIf="reconciliation()">
      <div class="recon-card">
        <h4>ðŸ¦ NgÃ¢n hÃ ng</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.bankBalance | number}}Ä‘</div>
        <small>{{reconciliation()!.bankAccounts.accountCount}} tÃ i khoáº£n</small>
      </div>
      <div class="recon-card">
        <h4>ðŸ›ï¸ CÃ¡c Quá»¹</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.fundBalance | number}}Ä‘</div>
        <small>{{reconciliation()!.funds.fundCount}} quá»¹</small>
      </div>
      <div class="recon-card">
        <h4>ðŸ‘› VÃ­ Phá»¥ huynh (Ná»£)</h4>
        <div class="recon-value amount-red">{{reconciliation()!.healthIndicators.walletLiability | number}}Ä‘</div>
        <small>Tiá»n trong vÃ­ PH</small>
      </div>
      <div class="recon-card" *ngIf="reconciliation()!.healthIndicators.loanDebt">
        <h4>&#128178; Ná»£ vay</h4>
        <div class="recon-value amount-red">{{reconciliation()!.healthIndicators.loanDebt | number}}Ä‘</div>
        <small>{{reconciliation()!.loanSummary?.activeLoanCount || 0}} khoáº£n vay</small>
      </div>
      <div class="recon-card" [class.positive]="reconciliation()!.healthIndicators.netPosition >= 0"
           [class.negative]="reconciliation()!.healthIndicators.netPosition < 0">
        <h4>ðŸ“Š Vá»‹ tháº¿ rÃ²ng</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.netPosition | number}}Ä‘</div>
        <small>NH + Quá»¹ - Ná»£ PH - Ná»£ vay</small>
      </div>
      <div class="recon-card" [class.warning-card]="reconciliation()!.healthIndicators.unreconciledItems > 0">
        <h4>ðŸ“‹ ChÆ°a Ä‘á»‘i soÃ¡t</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.unreconciledItems}}</div>
        <small>giao dá»‹ch</small>
      </div>
      <div class="recon-card" [class.warning-card]="reconciliation()!.healthIndicators.fundWarnings > 0">
        <h4>âš ï¸ Cáº£nh bÃ¡o Quá»¹</h4>
        <div class="recon-value">{{reconciliation()!.healthIndicators.fundWarnings}}</div>
        <small>quá»¹ dÆ°á»›i ngÆ°á»¡ng</small>
      </div>
    </div>

    <div class="recon-pnl" *ngIf="reconciliation()?.profitAndLoss">
      <h4>TÃ³m táº¯t lÃ£i/lá»— trong ká»³</h4>
      <div class="pnl-row">
        <span>Lá»£i nhuáº­n gá»™p:</span>
        <span>{{reconciliation()!.profitAndLoss.grossProfit | number}}Ä‘ ({{reconciliation()!.profitAndLoss.grossMargin}}%)</span>
      </div>
      <div class="pnl-row bold">
        <span>Lá»£i nhuáº­n rÃ²ng:</span>
        <span [class.amount-green]="reconciliation()!.profitAndLoss.netProfit >= 0"
              [class.amount-red]="reconciliation()!.profitAndLoss.netProfit < 0">
          {{reconciliation()!.profitAndLoss.netProfit | number}}Ä‘ ({{reconciliation()!.profitAndLoss.netMargin}}%)
        </span>
      </div>
    </div>
  </div>

  <!-- â•â•â• TAB: Alerts (Cáº£nh bÃ¡o & Chá»‰ dáº«n) â•â•â• -->
  <div *ngIf="activeTab === 'alerts'" class="tab-content">
    <div class="section-header">
      <h3>Cáº£nh bÃ¡o & Chá»‰ dáº«n hÃ nh Ä‘á»™ng</h3>
      <button class="primary" (click)="loadTab('alerts')">ðŸ”„ LÃ m má»›i</button>
    </div>

    <ng-container *ngIf="alertsData()">
      <!-- Alert summary badges -->
      <div class="alert-summary">
        <div class="alert-badge critical" *ngIf="alertsData()!.criticalCount > 0">
          ðŸ”´ {{alertsData()!.criticalCount}} NghiÃªm trá»ng
        </div>
        <div class="alert-badge warning" *ngIf="alertsData()!.warningCount > 0">
          ðŸŸ¡ {{alertsData()!.warningCount}} Cáº£nh bÃ¡o
        </div>
        <div class="alert-badge info" *ngIf="alertsData()!.infoCount > 0">
          ðŸ”µ {{alertsData()!.infoCount}} ThÃ´ng tin
        </div>
        <div class="alert-badge ok" *ngIf="alertsData()!.totalAlerts === 0">
          âœ… KhÃ´ng cÃ³ cáº£nh bÃ¡o nÃ o
        </div>
      </div>

      <!-- Marketing Budget Overview -->
      <div class="marketing-budget-section" *ngIf="alertsData()!.marketingBudget.optimalDailyBudget > 0">
        <h4>ðŸ“¢ NGÃ‚N SÃCH MARKETING Tá»I Æ¯U (tá»« phÃ¢n tÃ­ch QC)</h4>
        <div class="mkt-overview">
          <div class="mkt-card">
            <div class="mkt-label">Quá»¹ Marketing hiá»‡n táº¡i</div>
            <div class="mkt-value">{{alertsData()!.marketingBudget.fundBalance | number}}Ä‘</div>
          </div>
          <div class="mkt-card">
            <div class="mkt-label">Chi phÃ­ QC tá»‘i Æ°u / ngÃ y</div>
            <div class="mkt-value amount-blue">{{alertsData()!.marketingBudget.optimalDailyBudget | number}}Ä‘</div>
          </div>
          <div class="mkt-card">
            <div class="mkt-label">Chi phÃ­ QC tá»‘i Æ°u / thÃ¡ng</div>
            <div class="mkt-value amount-blue">{{alertsData()!.marketingBudget.optimalMonthlyBudget | number}}Ä‘</div>
          </div>
          <div class="mkt-card" [class.positive]="alertsData()!.marketingBudget.fundBalance >= alertsData()!.marketingBudget.optimalMonthlyBudget"
               [class.negative]="alertsData()!.marketingBudget.fundBalance < alertsData()!.marketingBudget.optimalMonthlyBudget">
            <div class="mkt-label">Äá»§ cho</div>
            <div class="mkt-value">
              {{alertsData()!.marketingBudget.optimalMonthlyBudget > 0
                ? (alertsData()!.marketingBudget.fundBalance / alertsData()!.marketingBudget.optimalMonthlyBudget | number:'1.1-1')
                : 'âˆž'}} thÃ¡ng
            </div>
          </div>
        </div>

        <!-- Group breakdown -->
        <div class="mkt-breakdown" *ngIf="alertsData()!.marketingBudget.groupBreakdown.length">
          <h5>Chi tiáº¿t theo nhÃ³m quáº£ng cÃ¡o</h5>
          <table class="data">
            <thead><tr>
              <th>NhÃ³m QC</th><th>Ná»n táº£ng</th><th>Chi hiá»‡n táº¡i/ngÃ y</th>
              <th>Äá» xuáº¥t tá»‘i Æ°u/ngÃ y</th><th>Thay Ä‘á»•i</th><th>Äá»™ tin cáº­y</th><th>LÃ½ do</th>
            </tr></thead>
            <tbody>
              <tr *ngFor="let g of alertsData()!.marketingBudget.groupBreakdown">
                <td><strong>{{g.adGroupName || g.adGroupId}}</strong></td>
                <td><span class="badge platform">{{g.platform}}</span></td>
                <td class="right">{{g.currentDailySpend | number}}Ä‘</td>
                <td class="right amount-blue"><strong>{{g.optimalDailySpend | number}}Ä‘</strong></td>
                <td class="right" [class.amount-green]="g.changePercent > 0" [class.amount-red]="g.changePercent < 0">
                  {{g.changePercent > 0 ? '+' : ''}}{{g.changePercent || 0}}%
                </td>
                <td>
                  <span class="badge" [class.high-conf]="g.confidence === 'HIGH'"
                        [class.med-conf]="g.confidence === 'MEDIUM'" [class.low-conf]="g.confidence === 'LOW'">
                    {{g.confidence}}
                  </span>
                </td>
                <td class="reason-text">{{g.reason}}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alert Cards -->
      <div class="alerts-list" *ngIf="alertsData()!.alerts.length">
        <div class="alert-card" *ngFor="let alert of alertsData()!.alerts"
             [class.alert-critical]="alert.severity === 'CRITICAL'"
             [class.alert-warning]="alert.severity === 'WARNING'"
             [class.alert-info]="alert.severity === 'INFO'">
          <div class="alert-header">
            <span class="alert-severity">
              {{alert.severity === 'CRITICAL' ? 'ðŸ”´' : alert.severity === 'WARNING' ? 'ðŸŸ¡' : 'ðŸ”µ'}}
            </span>
            <span class="alert-category-tag">{{alertCategoryLabel(alert.category)}}</span>
            <h4 class="alert-title">{{alert.title}}</h4>
          </div>
          <p class="alert-message">{{alert.message}}</p>
          <div class="alert-actions" *ngIf="alert.actions.length">
            <span class="action-label">HÃ nh Ä‘á»™ng Ä‘á» xuáº¥t:</span>
            <div class="action-buttons">
              <button *ngFor="let action of alert.actions"
                      class="action-btn"
                      [class.action-navigate]="action.type === 'NAVIGATE'"
                      [class.action-fund]="action.type === 'FUND_DEPOSIT' || action.type === 'FUND_WITHDRAW'"
                      [class.action-info]="action.type === 'INFO'"
                      (click)="handleAlertAction(action)">
                {{action.type === 'NAVIGATE' ? 'â†’' : action.type === 'INFO' ? 'â„¹ï¸' : 'ðŸ’°'}} {{action.label}}
              </button>
            </div>
          </div>
        </div>
      </div>

      <p class="empty-text" *ngIf="!alertsData()!.alerts.length">âœ… KhÃ´ng cÃ³ cáº£nh bÃ¡o nÃ o. TÃ i chÃ­nh Ä‘ang á»•n Ä‘á»‹nh!</p>
    </ng-container>
    <p class="empty-text" *ngIf="!alertsData()">Äang táº£i dá»¯ liá»‡u cáº£nh bÃ¡o...</p>
  </div>

  <!-- â•â•â• MODALS â•â•â• -->

  <!-- Modal: Create Bank Account -->
  <div class="modal-backdrop" *ngIf="showBankAccountModal()">
    <div class="modal">
      <h3>ThÃªm tÃ i khoáº£n ngÃ¢n hÃ ng</h3>
      <form (ngSubmit)="submitBankAccount()" #baForm="ngForm">
        <label>TÃªn ngÃ¢n hÃ ng <span class="req">*</span>
          <input name="bankName" [(ngModel)]="bankAccountForm.bankName" required />
        </label>
        <label>Sá»‘ tÃ i khoáº£n <span class="req">*</span>
          <input name="accountNumber" [(ngModel)]="bankAccountForm.accountNumber" required />
        </label>
        <label>Chá»§ tÃ i khoáº£n
          <input name="accountHolder" [(ngModel)]="bankAccountForm.accountHolder" />
        </label>
        <label>Chi nhÃ¡nh
          <input name="branch" [(ngModel)]="bankAccountForm.branch" />
        </label>
        <label>Sá»‘ dÆ° ban Ä‘áº§u (Ä‘)
          <input name="openingBalance" type="number" [(ngModel)]="bankAccountForm.openingBalance" min="0" />
        </label>
        <label>MÃ´ táº£
          <textarea name="description" [(ngModel)]="bankAccountForm.description" rows="2"></textarea>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="isPrimary" [(ngModel)]="bankAccountForm.isPrimary" />
          TÃ i khoáº£n chÃ­nh
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Táº¡o</button>
          <button type="button" (click)="showBankAccountModal.set(false)">Há»§y</button>
        </div>
        <p class="error" *ngIf="modalError()">{{modalError()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal: Record Bank Transaction -->
  <div class="modal-backdrop" *ngIf="showBankTxModal()">
    <div class="modal">
      <h3>Ghi nháº­n giao dá»‹ch ngÃ¢n hÃ ng</h3>
      <form (ngSubmit)="submitBankTx()">
        <label>TÃ i khoáº£n <span class="req">*</span>
          <select [(ngModel)]="bankTxForm.bankAccountId" name="bankAccountId" required>
            <option *ngFor="let ba of bankAccounts()" [value]="ba._id">{{ba.bankName}} - {{ba.accountNumber}}</option>
          </select>
        </label>
        <label>Loáº¡i giao dá»‹ch <span class="req">*</span>
          <select [(ngModel)]="bankTxForm.type" name="type" required>
            <option value="DEPOSIT">Náº¡p vÃ o</option>
            <option value="WITHDRAWAL">RÃºt ra</option>
            <option value="TRANSFER_IN">Chuyá»ƒn khoáº£n Ä‘áº¿n</option>
            <option value="TRANSFER_OUT">Chuyá»ƒn khoáº£n Ä‘i</option>
            <option value="INTEREST">LÃ£i suáº¥t</option>
            <option value="FEE">PhÃ­ dá»‹ch vá»¥</option>
            <option value="ADJUSTMENT">Äiá»u chá»‰nh</option>
          </select>
        </label>
        <label>Danh má»¥c
          <select [(ngModel)]="bankTxForm.category" name="category">
            <option value="TUITION_INCOME">Thu há»c phÃ­</option>
            <option value="PAYROLL">Chi lÆ°Æ¡ng</option>
            <option value="EXPENSE">Chi phÃ­ VH</option>
            <option value="RESERVE_FUND">Quá»¹ dá»± phÃ²ng</option>
            <option value="PETTY_CASH">Tiá»n máº·t</option>
            <option value="COMMISSION">Hoa há»“ng</option>
            <option value="REFUND">HoÃ n tiá»n</option>
            <option value="OTHER">KhÃ¡c</option>
          </select>
        </label>
        <div class="form-grid">
          <label>Sá»‘ tiá»n (Ä‘) <span class="req">*</span>
            <input name="amount" type="number" [(ngModel)]="bankTxForm.amount" required min="0" />
          </label>
          <label>NgÃ y giao dá»‹ch <span class="req">*</span>
            <input name="transactionDate" type="date" [(ngModel)]="bankTxForm.transactionDate" required />
          </label>
        </div>
        <label>MÃ´ táº£
          <textarea name="description" [(ngModel)]="bankTxForm.description" rows="2"></textarea>
        </label>
        <label>Tham chiáº¿u (mÃ£ hÃ³a Ä‘Æ¡n, lÆ°Æ¡ng...)
          <input name="reference" [(ngModel)]="bankTxForm.reference" />
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Ghi nháº­n</button>
          <button type="button" (click)="showBankTxModal.set(false)">Há»§y</button>
        </div>
        <p class="error" *ngIf="modalError()">{{modalError()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal: Create Fund -->
  <div class="modal-backdrop" *ngIf="showFundModal()">
    <div class="modal">
      <h3>Táº¡o quá»¹ má»›i</h3>
      <form (ngSubmit)="submitFund()">
        <label>TÃªn quá»¹ <span class="req">*</span>
          <input name="name" [(ngModel)]="fundForm.name" required />
        </label>
        <label>Loáº¡i quá»¹ <span class="req">*</span>
          <select [(ngModel)]="fundForm.fundType" name="fundType" required>
            <option value="RESERVE">Quá»¹ dá»± phÃ²ng</option>
            <option value="PETTY_CASH">Quá»¹ tiá»n máº·t</option>
            <option value="MARKETING">Quá»¹ marketing</option>
            <option value="TRAINING">Quá»¹ Ä‘Ã o táº¡o</option>
            <option value="BONUS">Quá»¹ thÆ°á»Ÿng</option>
            <option value="OTHER">Quá»¹ khÃ¡c</option>
          </select>
        </label>
        <div class="form-grid">
          <label>Sá»‘ dÆ° ban Ä‘áº§u (Ä‘)
            <input name="currentBalance" type="number" [(ngModel)]="fundForm.currentBalance" min="0" />
          </label>
          <label>Má»©c tá»‘i thiá»ƒu (Ä‘)
            <input name="minimumBalance" type="number" [(ngModel)]="fundForm.minimumBalance" min="0" />
          </label>
          <label>Má»©c Ä‘Ã­ch (Ä‘)
            <input name="targetBalance" type="number" [(ngModel)]="fundForm.targetBalance" min="0" />
          </label>
        </div>
        <label>MÃ´ táº£
          <textarea name="description" [(ngModel)]="fundForm.description" rows="2"></textarea>
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Táº¡o</button>
          <button type="button" (click)="showFundModal.set(false)">Há»§y</button>
        </div>
        <p class="error" *ngIf="modalError()">{{modalError()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal: Fund Transaction -->
  <div class="modal-backdrop" *ngIf="showFundTxModal()">
    <div class="modal">
      <h3>Náº¡p/RÃºt quá»¹: {{selectedFund()?.name}}</h3>
      <form (ngSubmit)="submitFundTx()">
        <label>Loáº¡i <span class="req">*</span>
          <select [(ngModel)]="fundTxForm.type" name="type" required>
            <option value="DEPOSIT">Náº¡p vÃ o</option>
            <option value="WITHDRAW">RÃºt ra</option>
            <option value="ADJUSTMENT">Äiá»u chá»‰nh</option>
          </select>
        </label>
        <div class="form-grid">
          <label>Sá»‘ tiá»n (Ä‘) <span class="req">*</span>
            <input name="amount" type="number" [(ngModel)]="fundTxForm.amount" required min="0" />
          </label>
          <label>NgÃ y <span class="req">*</span>
            <input name="transactionDate" type="date" [(ngModel)]="fundTxForm.transactionDate" required />
          </label>
        </div>
        <label>MÃ´ táº£
          <textarea name="description" [(ngModel)]="fundTxForm.description" rows="2"></textarea>
        </label>
        <label>Tham chiáº¿u
          <input name="reference" [(ngModel)]="fundTxForm.reference" />
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Thá»±c hiá»‡n</button>
          <button type="button" (click)="showFundTxModal.set(false)">Há»§y</button>
        </div>
        <p class="error" *ngIf="modalError()">{{modalError()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; padding:24px 32px 16px; }
    .page-header h2 { margin:0; font-size:22px; color:#1e293b; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .header-filters { display:flex; gap:8px; align-items:center; }
    .header-filters input { padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; }

    .tab-bar { display:flex; gap:4px; padding:0 32px; border-bottom:2px solid #e2e8f0; }
    .tab-bar button {
      padding:10px 16px; border:none; background:none; cursor:pointer;
      font-size:13px; color:#64748b; border-bottom:2px solid transparent; margin-bottom:-2px;
      transition: all 0.15s;
    }
    .tab-bar button.active { color:#2563eb; border-bottom-color:#2563eb; font-weight:600; }
    .tab-bar button:hover { color:#1e293b; }

    .tab-content { padding:16px 32px 32px; }

    /* Overview cards */
    .overview-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px; }
    .ov-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .ov-icon { font-size:28px; margin-bottom:8px; }
    .ov-value { font-size:20px; font-weight:700; color:#1e293b; }
    .ov-label { font-size:12px; color:#64748b; margin-top:4px; }
    .ov-warning { margin-top:8px; color:#f59e0b; font-size:12px; font-weight:600; }
    .ov-card.bank { border-left:4px solid #3b82f6; }
    .ov-card.fund { border-left:4px solid #8b5cf6; }
    .ov-card.inflow { border-left:4px solid #10b981; }
    .ov-card.outflow { border-left:4px solid #ef4444; }
    .ov-card.profit { border-left:4px solid #10b981; }
    .ov-card.loss { border-left:4px solid #ef4444; }
    .ov-detail { margin-top:6px; color:#64748b; line-height:1.6; }

    /* Dashboard sections */
    .dash-section { margin-bottom:24px; }
    .dash-section h4 { margin:0 0 12px; font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:700; }

    /* Metrics grid */
    .metrics-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; }
    .metric-card { background:#fff; border-radius:12px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .metric-label { font-size:12px; color:#64748b; margin-bottom:4px; }
    .metric-value { font-size:20px; font-weight:700; color:#1e293b; }
    .metric-hint { font-size:11px; color:#94a3b8; margin-top:4px; }

    /* P&L quick */
    .pnl-quick, .recon-pnl { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-top:16px; }
    .pnl-quick h4, .recon-pnl h4 { margin:0 0 12px; color:#1e293b; }
    .pnl-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }
    .pnl-row.bold { font-weight:600; }
    .pnl-row.total { font-weight:700; border-top:2px solid #e2e8f0; margin-top:8px; padding-top:12px; }
    .pnl-row.highlight { background:#f0fdf4; padding:12px; border-radius:8px; margin-top:8px; font-size:16px; border:none; }

    /* Warning section */
    .warning-section { background:#fffbeb; border:1px solid #f59e0b; border-radius:12px; padding:16px; margin-bottom:16px; }
    .warning-section h4 { margin:0 0 8px; color:#92400e; }
    .warning-item { padding:6px 0; font-size:13px; }

    /* Section headers */
    .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .section-header h3 { margin:0; color:#1e293b; }
    .section-header.mt { margin-top:32px; }

    /* Bank cards */
    .card-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px; margin-bottom:16px; }
    .bank-card, .fund-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); cursor:pointer; transition:transform 0.15s,box-shadow 0.15s; }
    .bank-card:hover, .fund-card:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.12); }
    .bank-card.primary-account { border:2px solid #2563eb; }
    .bank-name { font-weight:700; font-size:16px; color:#1e293b; }
    .account-num { font-size:13px; color:#64748b; font-family:monospace; }
    .bank-balance { font-size:22px; font-weight:700; color:#2563eb; margin:8px 0; }
    .bank-holder { font-size:12px; color:#94a3b8; }

    /* Fund cards */
    .fund-type { font-size:11px; text-transform:uppercase; color:#8b5cf6; font-weight:700; letter-spacing:0.5px; }
    .fund-name { font-weight:700; font-size:16px; color:#1e293b; margin:4px 0; }
    .fund-name code { font-size:11px; color:#94a3b8; }
    .fund-balance { font-size:22px; font-weight:700; color:#2563eb; margin:8px 0; }
    .fund-meta { display:flex; gap:16px; font-size:12px; color:#64748b; }
    .fund-card.warning { border:2px solid #f59e0b; }
    .fund-warning { color:#f59e0b; font-size:12px; font-weight:600; margin-top:8px; }
    .progress-bar { height:6px; background:#e2e8f0; border-radius:3px; margin-top:8px; overflow:hidden; }
    .progress-fill { height:100%; background:#2563eb; border-radius:3px; transition:width 0.3s; }

    /* Cash flow */
    .cashflow-summary { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:24px; }
    .cf-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); text-align:center; }
    .cf-card.inflow { border-top:3px solid #10b981; }
    .cf-card.outflow { border-top:3px solid #ef4444; }
    .cf-card.net.positive { border-top:3px solid #10b981; }
    .cf-card.net.negative { border-top:3px solid #ef4444; }
    .cf-value { font-size:20px; font-weight:700; margin-top:8px; }

    /* Reconciliation */
    .recon-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:16px; margin-bottom:24px; }
    .recon-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); text-align:center; }
    .recon-card h4 { margin:0 0 8px; font-size:14px; color:#64748b; }
    .recon-value { font-size:20px; font-weight:700; color:#1e293b; }
    .recon-card small { color:#94a3b8; font-size:12px; }
    .recon-card.positive { border-top:3px solid #10b981; }
    .recon-card.negative { border-top:3px solid #ef4444; }
    .recon-card.warning-card { border-top:3px solid #f59e0b; }

    /* P&L report */
    .pnl-report { background:#fff; border-radius:12px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .pnl-section { margin-bottom:24px; }
    .pnl-section h4 { margin:0 0 12px; color:#1e293b; }
    .pnl-section.summary { background:#f8fafc; border-radius:8px; padding:16px; }

    /* Common */
    .amount-green { color:#10b981; }
    .amount-red { color:#ef4444; }
    .amount-blue { color:#3b82f6; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; }
    .primary:hover { background:#1d4ed8; }
    .filters { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
    .filters.inline { display:inline-flex; }
    .filters select, .filters input { padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; }
    .empty-text { text-align:center; color:#94a3b8; padding:32px; font-size:14px; }

    .data { width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .data th { background:#f8fafc; text-align:left; padding:10px 12px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    .data td { padding:10px 12px; border-top:1px solid #f1f5f9; font-size:13px; }
    .data tr:hover { background:#f8fafc; }
    .data code { font-size:12px; color:#2563eb; }
    .right { text-align:right; }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
    .badge.active { background:#dcfce7; color:#16a34a; }
    .badge.inactive { background:#fee2e2; color:#dc2626; }
    .badge.reconciled { background:#dcfce7; color:#16a34a; }
    .btn-sm { padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; background:#fff; border-radius:4px; cursor:pointer; }
    .btn-sm:hover { background:#f1f5f9; }

    /* Modals */
    .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:999; }
    .modal { background:#fff; border-radius:16px; padding:28px; width:95%; max-width:520px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.15); }
    .modal h3 { margin:0 0 20px; font-size:18px; color:#1e293b; }
    label { display:block; margin-bottom:12px; font-size:13px; font-weight:600; color:#374151; }
    label input, label select, label textarea { display:block; width:100%; padding:8px 12px; margin-top:4px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; box-sizing:border-box; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
    .form-actions { display:flex; gap:8px; margin-top:16px; }
    .form-actions button { padding:10px 20px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:1px solid #d1d5db; background:#f8fafc; }
    .form-actions .primary { background:#2563eb; color:#fff; border-color:#2563eb; }
    .req { color:#ef4444; }
    .error { color:#ef4444; font-size:13px; margin-top:8px; }
    .checkbox-label { display:flex; align-items:center; gap:8px; flex-direction:row; }
    .checkbox-label input { width:auto; margin:0; }

    /* Alerts styles */
    .alert-summary { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
    .alert-badge { padding:8px 16px; border-radius:8px; font-weight:700; font-size:14px; }
    .alert-badge.critical { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
    .alert-badge.warning { background:#fffbeb; color:#d97706; border:1px solid #fde68a; }
    .alert-badge.info { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
    .alert-badge.ok { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }

    .marketing-budget-section { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:24px; border-left:4px solid #8b5cf6; }
    .marketing-budget-section h4 { margin:0 0 16px; font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:700; }
    .marketing-budget-section h5 { margin:16px 0 8px; color:#1e293b; font-size:14px; }
    .mkt-overview { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:16px; }
    .mkt-card { background:#f8fafc; border-radius:8px; padding:14px; text-align:center; }
    .mkt-card.positive { background:#f0fdf4; border:1px solid #bbf7d0; }
    .mkt-card.negative { background:#fef2f2; border:1px solid #fecaca; }
    .mkt-label { font-size:12px; color:#64748b; margin-bottom:4px; }
    .mkt-value { font-size:18px; font-weight:700; color:#1e293b; }
    .mkt-breakdown { margin-top:12px; }

    .badge.platform { background:#e0e7ff; color:#4338ca; }
    .badge.high-conf { background:#dcfce7; color:#16a34a; }
    .badge.med-conf { background:#fef9c3; color:#a16207; }
    .badge.low-conf { background:#fee2e2; color:#dc2626; }
    .reason-text { font-size:12px; color:#64748b; max-width:200px; }

    .alerts-list { display:flex; flex-direction:column; gap:16px; }
    .alert-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .alert-card.alert-critical { border-left:4px solid #dc2626; }
    .alert-card.alert-warning { border-left:4px solid #f59e0b; }
    .alert-card.alert-info { border-left:4px solid #3b82f6; }
    .alert-header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .alert-severity { font-size:18px; }
    .alert-category-tag { background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    .alert-title { margin:0; font-size:15px; color:#1e293b; flex:1; }
    .alert-message { margin:8px 0 12px; font-size:13px; color:#475569; line-height:1.6; }
    .alert-actions { border-top:1px solid #f1f5f9; padding-top:12px; }
    .action-label { font-size:11px; color:#94a3b8; text-transform:uppercase; font-weight:600; letter-spacing:0.5px; display:block; margin-bottom:8px; }
    .action-buttons { display:flex; gap:8px; flex-wrap:wrap; }
    .action-btn { padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid #e2e8f0; background:#f8fafc; color:#374151; transition:all 0.15s; }
    .action-btn:hover { background:#e2e8f0; }
    .action-btn.action-navigate { border-color:#bfdbfe; color:#2563eb; background:#eff6ff; }
    .action-btn.action-navigate:hover { background:#dbeafe; }
    .action-btn.action-fund { border-color:#bbf7d0; color:#16a34a; background:#f0fdf4; }
    .action-btn.action-fund:hover { background:#dcfce7; }
    .action-btn.action-info { border-color:#e2e8f0; color:#64748b; }
  `]
})
export class FinancialControlComponent implements OnInit {
  Math = Math;
  tabs = [
    { key: 'overview', label: 'Tá»•ng quan', icon: 'ðŸ“Š' },
    { key: 'alerts', label: 'Cáº£nh bÃ¡o', icon: 'ðŸš¨' },
    { key: 'bank', label: 'NgÃ¢n hÃ ng', icon: 'ðŸ¦' },
    { key: 'funds', label: 'Quá»¹', icon: 'ðŸ›ï¸' },
    { key: 'cashflow', label: 'DÃ²ng tiá»n', icon: 'ðŸ’°' },
    { key: 'pnl', label: 'P&L', icon: 'ðŸ“ˆ' },
    { key: 'reconciliation', label: 'Äá»‘i soÃ¡t', icon: 'ðŸ”„' },
  ];
  activeTab = 'overview';

  // Date filters
  startDate = '';
  endDate = '';

  // Data signals
  dashboard = signal<FinancialDashboard | null>(null);
  overview = signal<FinancialOverview | null>(null);
  bankAccounts = signal<BankAccount[]>([]);
  bankTransactions = signal<BankTransaction[]>([]);
  funds = signal<Fund[]>([]);
  fundTransactions = signal<FundTransaction[]>([]);
  cashFlow = signal<CashFlowData | null>(null);
  pnl = signal<ProfitAndLoss | null>(null);
  reconciliation = signal<any>(null);
  alertsData = signal<FinancialAlertsResponse | null>(null);

  // Selection
  selectedBankAccount = signal<BankAccount | null>(null);
  selectedFund = signal<Fund | null>(null);

  // Filter states
  bankTxType = '';
  bankTxKeyword = '';
  cashFlowGroupBy = 'month';
  pnlBasis: 'cash' | 'accrual' = 'cash';

  // Modals
  showBankAccountModal = signal(false);
  showBankTxModal = signal(false);
  showFundModal = signal(false);
  showFundTxModal = signal(false);
  modalError = signal('');

  // Forms
  bankAccountForm: any = { bankName: '', accountNumber: '', accountHolder: '', branch: '', openingBalance: 0, description: '', isPrimary: false };
  bankTxForm: any = { bankAccountId: '', type: 'DEPOSIT', category: 'OTHER', amount: 0, transactionDate: '', description: '', reference: '' };
  fundForm: any = { name: '', fundType: 'RESERVE', currentBalance: 0, minimumBalance: 0, targetBalance: 0, description: '' };
  fundTxForm: any = { type: 'DEPOSIT', amount: 0, transactionDate: '', description: '', reference: '' };

  constructor(private service: FinancialControlService, private auth: AuthService, private router: Router) {}

  ngOnInit() { this.reload(); }

  isDirector(): boolean { return this.auth.hasRole([Role.DIRECTOR]); }

  // Labels
  fundTypeLabel(t: string) { return FUND_TYPE_LABELS[t] || t; }
  txTypeLabel(t: string) { return TX_TYPE_LABELS[t] || t; }
  categoryLabel(c: string) { return CATEGORY_LABELS[c] || c; }
  expenseCatLabel(c: string) { return EXPENSE_CAT_LABELS[c] || c; }

  isInflow(type: string): boolean {
    return ['DEPOSIT', 'TRANSFER_IN', 'INTEREST'].includes(type);
  }

  invoiceTypeEntries() {
    if (!this.pnl()) return [];
    return Object.entries(this.pnl()!.revenue.byInvoiceType).map(([key, value]) => ({ key, value }));
  }

  expenseCatEntries() {
    if (!this.pnl()) return [];
    return Object.entries(this.pnl()!.costs.expenseByCategory).map(([key, value]) => ({ key, value }));
  }

  adCostPlatformEntries() {
    if (!this.pnl()?.costs?.adCostByPlatform) return [];
    return Object.entries(this.pnl()!.costs.adCostByPlatform).map(([key, value]) => ({ key, value }));
  }

  async reload() {
    this.loadTab(this.activeTab);
  }

  async loadTab(tab: string) {
    try {
      switch (tab) {
        case 'overview':
          this.dashboard.set(await this.service.getDashboard());
          break;
        case 'alerts':
          this.alertsData.set(await this.service.getAlerts());
          break;
        case 'bank':
          this.bankAccounts.set(await this.service.getBankAccounts());
          this.loadBankTransactions();
          break;
        case 'funds':
          this.funds.set(await this.service.getFunds());
          break;
        case 'cashflow':
          this.loadCashFlow();
          break;
        case 'pnl':
          await this.loadPnl();
          break;
        case 'reconciliation':
          this.reconciliation.set(await this.service.getReconciliationReport(this.startDate, this.endDate));
          break;
      }
    } catch (err) { console.error('Error loading tab:', tab, err); }
  }

  async loadBankTransactions() {
    const params: Record<string, string> = {};
    if (this.selectedBankAccount()) params['bankAccountId'] = this.selectedBankAccount()!._id;
    if (this.bankTxType) params['type'] = this.bankTxType;
    if (this.bankTxKeyword) params['keyword'] = this.bankTxKeyword;
    if (this.startDate) params['startDate'] = this.startDate;
    if (this.endDate) params['endDate'] = this.endDate;
    this.bankTransactions.set(await this.service.getBankTransactions(params));
  }

  async loadCashFlow() {
    const params: Record<string, string> = { groupBy: this.cashFlowGroupBy };
    if (this.startDate) params['startDate'] = this.startDate;
    if (this.endDate) params['endDate'] = this.endDate;
    this.cashFlow.set(await this.service.getCashFlow(params));
  }

  async loadPnl() {
    this.pnl.set(await this.service.getProfitAndLoss(this.startDate, this.endDate, this.pnlBasis));
  }

  selectBankAccount(ba: BankAccount) {
    this.selectedBankAccount.set(ba);
    this.loadBankTransactions();
  }

  selectFund(f: Fund) {
    this.selectedFund.set(f);
    this.loadFundTransactions();
  }

  async loadFundTransactions() {
    if (!this.selectedFund()) return;
    const params: Record<string, string> = { fundId: this.selectedFund()!._id };
    if (this.startDate) params['startDate'] = this.startDate;
    if (this.endDate) params['endDate'] = this.endDate;
    this.fundTransactions.set(await this.service.getFundTransactions(params));
  }

  // â”€â”€â”€ Bank Account Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  openBankAccountModal() {
    this.bankAccountForm = { bankName: '', accountNumber: '', accountHolder: '', branch: '', openingBalance: 0, description: '', isPrimary: false };
    this.modalError.set('');
    this.showBankAccountModal.set(true);
  }

  async submitBankAccount() {
    const res = await this.service.createBankAccount(this.bankAccountForm);
    if (!res.ok) { this.modalError.set(res.message || 'Lá»—i'); return; }
    this.showBankAccountModal.set(false);
    this.bankAccounts.set(await this.service.getBankAccounts());
  }

  // â”€â”€â”€ Bank Transaction Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  openBankTxModal() {
    this.bankTxForm = {
      bankAccountId: this.selectedBankAccount()?._id || (this.bankAccounts().length ? this.bankAccounts()[0]._id : ''),
      type: 'DEPOSIT', category: 'OTHER', amount: 0, transactionDate: new Date().toISOString().split('T')[0], description: '', reference: '',
    };
    this.modalError.set('');
    this.showBankTxModal.set(true);
  }

  async submitBankTx() {
    const res = await this.service.recordBankTransaction(this.bankTxForm);
    if (!res.ok) { this.modalError.set(res.message || 'Lá»—i'); return; }
    this.showBankTxModal.set(false);
    this.bankAccounts.set(await this.service.getBankAccounts());
    this.loadBankTransactions();
  }

  async reconcile(txId: string) {
    if (!confirm('XÃ¡c nháº­n Ä‘á»‘i soÃ¡t giao dá»‹ch nÃ y?')) return;
    const res = await this.service.reconcileTransaction(txId);
    if (!res.ok) { alert(res.message); return; }
    this.loadBankTransactions();
  }

  // â”€â”€â”€ Fund Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  openFundModal() {
    this.fundForm = { name: '', fundType: 'RESERVE', currentBalance: 0, minimumBalance: 0, targetBalance: 0, description: '' };
    this.modalError.set('');
    this.showFundModal.set(true);
  }

  async submitFund() {
    const res = await this.service.createFund(this.fundForm);
    if (!res.ok) { this.modalError.set(res.message || 'Lá»—i'); return; }
    this.showFundModal.set(false);
    this.funds.set(await this.service.getFunds());
  }

  // â”€â”€â”€ Fund Transaction Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  openFundTxModal() {
    this.fundTxForm = {
      type: 'DEPOSIT', amount: 0, transactionDate: new Date().toISOString().split('T')[0], description: '', reference: '',
    };
    this.modalError.set('');
    this.showFundTxModal.set(true);
  }

  async submitFundTx() {
    const fund = this.selectedFund();
    if (!fund) return;
    const data = { ...this.fundTxForm, fundId: fund._id };
    const res = await this.service.recordFundTransaction(data);
    if (!res.ok) { this.modalError.set(res.message || 'Lá»—i'); return; }
    this.showFundTxModal.set(false);
    this.funds.set(await this.service.getFunds());
    this.selectedFund.set(this.funds().find(f => f._id === fund._id) || null);
    this.loadFundTransactions();
  }

  // â”€â”€â”€ Alerts helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private readonly ALERT_CATEGORY_LABELS: Record<string, string> = {
    MARKETING: 'Marketing',
    CASH_FLOW: 'DÃ²ng tiá»n',
    RESERVE: 'Dá»± phÃ²ng',
    FUND: 'Quá»¹',
    OBLIGATIONS: 'NghÄ©a vá»¥ TT',
    METRICS: 'Chá»‰ sá»‘',
    PROFITABILITY: 'Lá»£i nhuáº­n',
    RECONCILIATION: 'Äá»‘i soÃ¡t',
    EXPENSES: 'Chi phÃ­',
    RECEIVABLE: 'CÃ´ng ná»£',
    REVENUE: 'Doanh thu',
  };

  alertCategoryLabel(cat: string): string {
    return this.ALERT_CATEGORY_LABELS[cat] || cat;
  }

  private normalizeAppTarget(target: string): string {
    const trimmed = (target || '').trim();
    if (!trimmed) return '/app/dashboard';
    if (trimmed.startsWith('/app/')) return trimmed;
    if (trimmed.startsWith('/')) return `/app${trimmed}`;
    return `/app/${trimmed}`;
  }

  handleAlertAction(action: { label: string; type: string; target?: string; amount?: number }) {
    switch (action.type) {
      case 'NAVIGATE':
        if (!action.target) break;
        const normalizedTarget = this.normalizeAppTarget(action.target);
        if (normalizedTarget.startsWith('/app/financial-control')) {
          const tabMatch = normalizedTarget.match(/[?&]tab=(\w+)/);
          if (tabMatch) {
            this.activeTab = tabMatch[1];
            this.loadTab(tabMatch[1]);
          }
        }
        this.router.navigateByUrl(normalizedTarget);
        break;
      case 'FUND_DEPOSIT':
        // Open fund transaction modal for deposit
        this.activeTab = 'funds';
        this.loadTab('funds').then(() => {
          const targetFund = this.funds().find(f =>
            f.fundType === action.target || f.fundCode === action.target
          );
          if (targetFund) {
            this.selectFund(targetFund);
            setTimeout(() => {
              this.fundTxForm = {
                type: 'DEPOSIT',
                amount: action.amount || 0,
                transactionDate: new Date().toISOString().split('T')[0],
                description: `Náº¡p quá»¹ theo Ä‘á» xuáº¥t cáº£nh bÃ¡o: ${action.label}`,
                reference: '',
              };
              this.modalError.set('');
              this.showFundTxModal.set(true);
            }, 300);
          }
        });
        break;
      case 'FUND_WITHDRAW':
        this.activeTab = 'funds';
        this.loadTab('funds').then(() => {
          const targetFund = this.funds().find(f =>
            f.fundType === action.target || f.fundCode === action.target
          );
          if (targetFund) {
            this.selectFund(targetFund);
            setTimeout(() => {
              this.fundTxForm = {
                type: 'WITHDRAW',
                amount: action.amount || 0,
                transactionDate: new Date().toISOString().split('T')[0],
                description: `RÃºt quá»¹ theo Ä‘á» xuáº¥t: ${action.label}`,
                reference: '',
              };
              this.modalError.set('');
              this.showFundTxModal.set(true);
            }, 300);
          }
        });
        break;
      case 'INFO':
        alert(action.label);
        break;
    }
  }
}
