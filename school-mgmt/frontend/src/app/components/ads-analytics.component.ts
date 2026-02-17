import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdsService, AdGroupItem, AdAnalyticsResponse, AdAnalyticsRow,
  AdAnalyticsSummary, AdSuggestionResponse, AdSuggestionRow,
} from '../services/ads.service';

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  TIKTOK: 'TikTok',
};

@Component({
  selector: 'app-ads-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <header class="page-header">
    <div>
      <h2>Phân tích Quảng cáo</h2>
      <p>Chi phí/đơn, chi phí/lead, lợi nhuận thuần theo nhóm QC và đề xuất phân bổ ngân sách.</p>
    </div>
  </header>

  <!-- Filters -->
  <section class="filters">
    <label>Từ ngày <input type="date" [(ngModel)]="startDate" /></label>
    <label>Đến ngày <input type="date" [(ngModel)]="endDate" /></label>
    <select [(ngModel)]="filterPlatform">
      <option value="">Tất cả nền tảng</option>
      <option value="FACEBOOK">Facebook</option>
      <option value="GOOGLE">Google</option>
      <option value="TIKTOK">TikTok</option>
    </select>
    <select [(ngModel)]="filterAdGroup">
      <option value="">Tất cả nhóm QC</option>
      <option *ngFor="let g of adGroups()" [value]="g._id">{{g.name}}</option>
    </select>
    <button class="primary" (click)="loadAnalytics()">Phân tích</button>
  </section>

  <!-- Summary Cards -->
  <section class="stats" *ngIf="summary()">
    <div class="stat-card blue">
      <div class="stat-value">{{summary()!.totalSpend | number}}đ</div>
      <div class="stat-label">Tổng chi phí Ads</div>
    </div>
    <div class="stat-card teal">
      <div class="stat-value">{{summary()!.totalLeads | number}}</div>
      <div class="stat-label">Tổng Leads</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-value">{{summary()!.totalOrders | number}}</div>
      <div class="stat-label">Tổng Đơn hàng</div>
    </div>
    <div class="stat-card green">
      <div class="stat-value">{{summary()!.totalRevenue | number}}đ</div>
      <div class="stat-label">Tổng Doanh thu</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-value">{{summary()!.avgCostPerLead | number}}đ</div>
      <div class="stat-label">CP / Lead (TB)</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-value">{{summary()!.avgCostPerOrder | number}}đ</div>
      <div class="stat-label">CP / Đơn (TB)</div>
    </div>
    <div class="stat-card" [class.green]="summary()!.totalNetProfit >= 0" [class.red]="summary()!.totalNetProfit < 0">
      <div class="stat-value">{{summary()!.totalNetProfit | number}}đ</div>
      <div class="stat-label">Lợi nhuận thuần</div>
    </div>
    <div class="stat-card" [class.green]="summary()!.avgRoi >= 0" [class.red]="summary()!.avgRoi < 0">
      <div class="stat-value">{{summary()!.avgRoi}}%</div>
      <div class="stat-label">ROI trung bình</div>
    </div>
  </section>

  <!-- Per-Group Analytics Table -->
  <section class="section" *ngIf="rows().length">
    <h3>Chi tiết theo nhóm QC</h3>
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th (click)="sortBy('adGroupName')" class="sortable">Nhóm QC</th>
            <th>Nền tảng</th>
            <th (click)="sortBy('totalSpend')" class="sortable">Chi phí</th>
            <th (click)="sortBy('leadCount')" class="sortable">Leads</th>
            <th (click)="sortBy('orderCount')" class="sortable">Đơn hàng</th>
            <th (click)="sortBy('revenue')" class="sortable">Doanh thu</th>
            <th (click)="sortBy('costPerLead')" class="sortable">CP/Lead</th>
            <th (click)="sortBy('costPerOrder')" class="sortable">CP/Đơn</th>
            <th (click)="sortBy('netProfit')" class="sortable">Lợi nhuận</th>
            <th (click)="sortBy('roi')" class="sortable">ROI %</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of sortedRows()">
            <td><strong>{{r.adGroupName || r.adGroupId}}</strong></td>
            <td><span class="badge platform" [attr.data-platform]="r.platform">{{platformLabel(r.platform)}}</span></td>
            <td class="amount">{{r.totalSpend | number}}đ</td>
            <td>{{r.leadCount}}</td>
            <td>{{r.orderCount}}</td>
            <td class="amount">{{r.revenue | number}}đ</td>
            <td>{{r.costPerLead !== null ? (r.costPerLead | number) + 'đ' : '-'}}</td>
            <td>{{r.costPerOrder !== null ? (r.costPerOrder | number) + 'đ' : '-'}}</td>
            <td [class.amount-green]="r.netProfit >= 0" [class.amount-red]="r.netProfit < 0">
              {{r.netProfit | number}}đ
            </td>
            <td>
              <span class="roi-badge" [class.roi-high]="r.roi >= 100" [class.roi-mid]="r.roi >= 50 && r.roi < 100" [class.roi-low]="r.roi < 50">
                {{r.roi}}%
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <p class="empty" *ngIf="loaded() && !rows().length">Không có dữ liệu trong khoảng thời gian này.</p>

  <!-- ═══ Budget Suggestion Section ═══ -->
  <section class="section suggestion-section">
    <h3>Đề xuất phân bổ ngân sách</h3>
    <p class="desc">Dựa trên thuật toán lợi nhuận biên giảm dần, hệ thống đề xuất cách phân bổ ngân sách tối ưu giữa các nhóm QC.</p>

    <div class="suggestion-input">
      <label>Tổng ngân sách hàng ngày (VNĐ)
        <input type="number" [(ngModel)]="totalBudget" min="0" step="100000" />
      </label>
      <button class="primary" (click)="loadSuggestions()" [disabled]="!totalBudget || sugLoading()">
        {{sugLoading() ? 'Đang tính...' : 'Đề xuất phân bổ'}}
      </button>
    </div>

    <div *ngIf="sugData()">
      <div class="sug-summary">
        <span><strong>Tổng ngân sách:</strong> {{sugData()!.totalBudget | number}}đ</span>
        <span><strong>Đã phân bổ:</strong> {{sugData()!.allocated | number}}đ</span>
      </div>

      <table class="data" *ngIf="sugData()!.suggestions.length">
        <thead>
          <tr>
            <th>Nhóm QC</th>
            <th>Nền tảng</th>
            <th>CP hiện tại/ngày</th>
            <th>CP đề xuất/ngày</th>
            <th>Tăng/Giảm</th>
            <th>Đơn dự kiến</th>
            <th>DT dự kiến</th>
            <th>CP/Đơn dự kiến</th>
            <th>Độ tin cậy</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of sugData()!.suggestions">
            <td><strong>{{s.adGroupName || s.adGroupId}}</strong></td>
            <td><span class="badge platform" [attr.data-platform]="s.platform">{{platformLabel(s.platform)}}</span></td>
            <td class="amount">{{s.currentDailySpend | number}}đ</td>
            <td class="amount">{{s.suggestedDailySpend !== null ? (s.suggestedDailySpend | number) + 'đ' : '-'}}</td>
            <td>
              <span *ngIf="s.changePercent !== null"
                    [class.amount-green]="s.changePercent! > 0"
                    [class.amount-red]="s.changePercent! < 0">
                {{s.changePercent! > 0 ? '+' : ''}}{{s.changePercent}}%
              </span>
              <span *ngIf="s.changePercent === null">-</span>
            </td>
            <td>{{s.expectedOrders !== null ? s.expectedOrders : '-'}}</td>
            <td class="amount">{{s.expectedRevenue !== null ? (s.expectedRevenue | number) + 'đ' : '-'}}</td>
            <td>{{s.expectedCostPerOrder !== null ? (s.expectedCostPerOrder | number) + 'đ' : '-'}}</td>
            <td>
              <span class="confidence-badge" [attr.data-level]="s.confidence">{{confidenceLabel(s.confidence)}}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Visual bar comparison -->
      <div class="bar-chart" *ngIf="sugData()!.suggestions.length">
        <h4>So sánh phân bổ hiện tại vs đề xuất</h4>
        <div class="bar-row" *ngFor="let s of sugData()!.suggestions">
          <div class="bar-label">{{s.adGroupName || s.adGroupId}}</div>
          <div class="bar-container">
            <div class="bar current" [style.width.%]="barWidth(s.currentDailySpend)" title="Hiện tại: {{s.currentDailySpend | number}}đ"></div>
            <div class="bar suggested" [style.width.%]="barWidth(s.suggestedDailySpend || 0)" title="Đề xuất: {{(s.suggestedDailySpend || 0) | number}}đ"></div>
          </div>
        </div>
        <div class="bar-legend">
          <span class="legend-item"><span class="legend-color current"></span> Hiện tại</span>
          <span class="legend-item"><span class="legend-color suggested"></span> Đề xuất</span>
        </div>
      </div>
    </div>
  </section>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 20px; }
    .page-header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }

    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 20px; }
    .filters input, .filters select { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .filters label { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #475569; }

    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { padding: 16px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .stat-value { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .stat-label { font-size: 12px; color: #64748b; }
    .stat-card.blue { border-left: 4px solid #3b82f6; }
    .stat-card.teal { border-left: 4px solid #14b8a6; }
    .stat-card.indigo { border-left: 4px solid #6366f1; }
    .stat-card.green { border-left: 4px solid #10b981; }
    .stat-card.orange { border-left: 4px solid #f59e0b; }
    .stat-card.purple { border-left: 4px solid #8b5cf6; }
    .stat-card.red { border-left: 4px solid #ef4444; }

    .section { margin-bottom: 32px; }
    .section h3 { font-size: 16px; margin: 0 0 12px; }
    .desc { font-size: 13px; color: #64748b; margin: 0 0 16px; }

    .table-wrap { overflow-x: auto; }
    table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.data th { text-align: left; padding: 8px 10px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 12px; }
    table.data th.sortable { cursor: pointer; }
    table.data th.sortable:hover { color: #1e40af; }
    table.data td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    table.data tr:hover { background: #f8fafc; }
    td.amount { font-weight: 600; }
    .amount-green { color: #10b981; }
    .amount-red { color: #ef4444; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; color: #fff; }
    .badge.platform { background: #3b82f6; }
    .badge.platform[data-platform="FACEBOOK"] { background: #1877f2; }
    .badge.platform[data-platform="GOOGLE"] { background: #ea4335; }
    .badge.platform[data-platform="TIKTOK"] { background: #000; }

    .roi-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 700; }
    .roi-high { background: #d1fae5; color: #065f46; }
    .roi-mid { background: #fef3c7; color: #92400e; }
    .roi-low { background: #fee2e2; color: #991b1b; }

    button.primary { padding: 8px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    button.primary:hover { background: #2563eb; }
    button.primary:disabled { background: #93c5fd; cursor: not-allowed; }

    .empty { text-align: center; color: #94a3b8; padding: 40px; }

    .suggestion-section { background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; }
    .suggestion-input { display: flex; gap: 12px; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; }
    .suggestion-input label { font-size: 13px; color: #475569; font-weight: 500; }
    .suggestion-input input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; width: 200px; margin-top: 4px; display: block; }

    .sug-summary { display: flex; gap: 24px; margin-bottom: 16px; font-size: 14px; }

    .confidence-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .confidence-badge[data-level="HIGH"] { background: #d1fae5; color: #065f46; }
    .confidence-badge[data-level="MEDIUM"] { background: #fef3c7; color: #92400e; }
    .confidence-badge[data-level="LOW"] { background: #fee2e2; color: #991b1b; }

    .bar-chart { margin-top: 24px; }
    .bar-chart h4 { font-size: 14px; margin: 0 0 12px; }
    .bar-row { display: flex; align-items: center; margin-bottom: 8px; gap: 8px; }
    .bar-label { width: 140px; font-size: 12px; text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-container { flex: 1; position: relative; height: 24px; }
    .bar { height: 10px; border-radius: 4px; position: absolute; }
    .bar.current { background: #93c5fd; top: 0; }
    .bar.suggested { background: #3b82f6; top: 12px; }
    .bar-legend { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-color { width: 12px; height: 12px; border-radius: 3px; }
    .legend-color.current { background: #93c5fd; }
    .legend-color.suggested { background: #3b82f6; }
  `],
})
export class AdsAnalyticsComponent implements OnInit {
  startDate = '';
  endDate = '';
  filterPlatform = '';
  filterAdGroup = '';
  totalBudget = 0;

  adGroups = signal<AdGroupItem[]>([]);
  rows = signal<AdAnalyticsRow[]>([]);
  summary = signal<AdAnalyticsSummary | null>(null);
  loaded = signal(false);
  sugData = signal<AdSuggestionResponse | null>(null);
  sugLoading = signal(false);

  sortField = 'totalSpend';
  sortDir: 'asc' | 'desc' = 'desc';

  private maxSpend = 0;

  constructor(private adsService: AdsService) {}

  ngOnInit() {
    const now = new Date();
    this.endDate = now.toISOString().split('T')[0];
    const past = new Date(now.getTime() - 30 * 86400000);
    this.startDate = past.toISOString().split('T')[0];

    this.loadAdGroups();
    this.loadAnalytics();
  }

  platformLabel(p: string) { return PLATFORM_LABELS[p] || p; }

  confidenceLabel(c: string) {
    if (c === 'HIGH') return 'Cao';
    if (c === 'MEDIUM') return 'Trung bình';
    return 'Thấp';
  }

  async loadAdGroups() {
    try {
      const groups = await this.adsService.getAllGroups();
      this.adGroups.set(groups);
    } catch {
      this.adGroups.set([]);
    }
  }

  async loadAnalytics() {
    if (!this.startDate || !this.endDate) return;
    try {
      const res = await this.adsService.getAnalytics(
        this.startDate, this.endDate, this.filterAdGroup || undefined, this.filterPlatform || undefined,
      );
      this.rows.set(res.rows);
      this.summary.set(res.summary);
      this.loaded.set(true);
    } catch {
      this.rows.set([]);
      this.summary.set(null);
      this.loaded.set(true);
    }
  }

  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'desc';
    }
  }

  sortedRows(): AdAnalyticsRow[] {
    const list = [...this.rows()];
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const field = this.sortField as keyof AdAnalyticsRow;
    list.sort((a, b) => {
      const va = a[field] ?? 0;
      const vb = b[field] ?? 0;
      if (typeof va === 'string') return va.localeCompare(vb as string) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return list;
  }

  async loadSuggestions() {
    if (!this.startDate || !this.endDate || !this.totalBudget) return;
    this.sugLoading.set(true);
    try {
      const res = await this.adsService.getSuggestions(this.startDate, this.endDate, this.totalBudget);
      this.sugData.set(res);

      // Calculate max spend for bar chart
      this.maxSpend = 0;
      for (const s of res.suggestions) {
        this.maxSpend = Math.max(this.maxSpend, s.currentDailySpend, s.suggestedDailySpend || 0);
      }
    } catch {
      this.sugData.set(null);
    }
    this.sugLoading.set(false);
  }

  barWidth(value: number): number {
    if (this.maxSpend <= 0) return 0;
    return Math.min(100, (value / this.maxSpend) * 100);
  }
}
