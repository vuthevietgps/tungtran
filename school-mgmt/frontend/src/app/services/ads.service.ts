import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

// â”€â”€â”€ Interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AdAccountItem {
  _id: string;
  accountCode: string;
  name: string;
  platform: string;
  platformAccountId: string;
  status: string;
  monthlyBudget?: number;
  notes?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdGroupItem {
  _id: string;
  groupCode: string;
  name: string;
  adAccountId: string;
  adAccountName?: string;
  platform: string;
  platformCampaignId: string;
  status: string;
  dailyBudget?: number;
  startDate?: string;
  endDate?: string;
  targetAudience?: string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTokenItem {
  _id: string;
  adAccountId: string;
  adAccountName?: string;
  platform: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  status: string;
  lastUsedAt?: string;
  label?: string;
  createdAt: string;
}

export interface AdCostItem {
  _id: string;
  adGroupId: string;
  adGroupName?: string;
  adAccountId: string;
  platform: string;
  date: string;
  spend: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  source: string;
  syncedAt?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdAnalyticsRow {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  leadCount: number;
  orderCount: number;
  revenue: number;
  costPerLead: number | null;
  costPerOrder: number | null;
  netProfit: number;
  roi: number;
}

export interface AdAnalyticsSummary {
  totalSpend: number;
  totalLeads: number;
  totalOrders: number;
  totalRevenue: number;
  totalNetProfit: number;
  avgCostPerLead: number;
  avgCostPerOrder: number;
  avgRoi: number;
}

export interface AdAnalyticsResponse {
  rows: AdAnalyticsRow[];
  summary: AdAnalyticsSummary;
}

export interface AdSuggestionRow {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  currentDailySpend: number;
  suggestedDailySpend: number;
  expectedDailyNetProfit: number | null;
  expectedDailyMarginalProfit: number | null;
  changePercent: number | null;
  confidence: string;
  dataPoints: number;
}

export interface AdSuggestionSummaryRow {
  date: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  netProfit: number;
  actualAdSpend: number;
  suggestedAdSpend: number;
}

export interface AdSuggestionDailyTotalRow {
  date: string;
  totalNetProfit: number;
  totalSuggestedAdSpend: number;
}

export interface AdSuggestionMonthlyProjectionRow {
  month: string;
  daysInMonth: number;
  projectedSpend: number;
  projectedNetProfit: number;
}

export interface AdSuggestionResponse {
  totalBudget: number;
  allocated: number;
  unallocated: number;
  totalSuggestedDailySpend: number;
  expectedDailyNetProfit: number;
  projectedMonthlySpend: number;
  projectedMonthlyNetProfit: number;
  dailySuggestedTotals: AdSuggestionDailyTotalRow[];
  monthlyProjection: AdSuggestionMonthlyProjectionRow[];
  summaryTable: AdSuggestionSummaryRow[];
  suggestions: AdSuggestionRow[];
}

@Injectable({
  providedIn: 'root',
})
export class AdsService {
  private apiUrl = `${environment.apiBase}/ads`;

  constructor(private http: HttpClient) {}

  private buildParams(params?: Record<string, string>): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return httpParams;
  }

  // â”€â”€â”€ Ad Accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listAccounts(params?: Record<string, string>): Promise<PaginatedResponse<AdAccountItem>> {
    return this.http.get<PaginatedResponse<AdAccountItem>>(
      `${this.apiUrl}/accounts`, { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<AdAccountItem>>;
  }

  async createAccount(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/accounts`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Táº¡o tÃ i khoáº£n tháº¥t báº¡i' };
    }
  }

  async updateAccount(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/accounts/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cáº­p nháº­t tháº¥t báº¡i' };
    }
  }

  async deleteAccount(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/accounts/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'XÃ³a tháº¥t báº¡i' };
    }
  }

  // â”€â”€â”€ Ad Groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listGroups(params?: Record<string, string>): Promise<PaginatedResponse<AdGroupItem>> {
    return this.http.get<PaginatedResponse<AdGroupItem>>(
      `${this.apiUrl}/groups`, { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<AdGroupItem>>;
  }

  async getAllGroups(): Promise<AdGroupItem[]> {
    return this.http.get<AdGroupItem[]>(`${this.apiUrl}/groups/all`).toPromise() as Promise<AdGroupItem[]>;
  }

  async getGroupsByPlatform(platform: string): Promise<AdGroupItem[]> {
    return this.http.get<AdGroupItem[]>(
      `${this.apiUrl}/groups/by-platform/${platform}`,
    ).toPromise() as Promise<AdGroupItem[]>;
  }

  async createGroup(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/groups`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Táº¡o nhÃ³m QC tháº¥t báº¡i' };
    }
  }

  async updateGroup(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/groups/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cáº­p nháº­t tháº¥t báº¡i' };
    }
  }

  async deleteGroup(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/groups/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'XÃ³a tháº¥t báº¡i' };
    }
  }

  // â”€â”€â”€ API Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listTokens(accountId: string): Promise<ApiTokenItem[]> {
    return this.http.get<ApiTokenItem[]>(
      `${this.apiUrl}/tokens/${accountId}`,
    ).toPromise() as Promise<ApiTokenItem[]>;
  }

  async createToken(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/tokens`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Táº¡o token tháº¥t báº¡i' };
    }
  }

  async updateToken(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/tokens/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cáº­p nháº­t tháº¥t báº¡i' };
    }
  }

  async deleteToken(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/tokens/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'XÃ³a tháº¥t báº¡i' };
    }
  }

  // â”€â”€â”€ Ad Costs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listCosts(params?: Record<string, string>): Promise<PaginatedResponse<AdCostItem>> {
    return this.http.get<PaginatedResponse<AdCostItem>>(
      `${this.apiUrl}/costs`, { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<AdCostItem>>;
  }

  async createCost(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/costs`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Táº¡o chi phÃ­ tháº¥t báº¡i' };
    }
  }

  async deleteCost(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/costs/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'XÃ³a tháº¥t báº¡i' };
    }
  }

  async triggerSync(accountId?: string): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      const url = accountId ? `${this.apiUrl}/sync/${accountId}` : `${this.apiUrl}/sync`;
      const result = await this.http.post<any>(url, {}).toPromise();
      return { ok: true, data: result };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Äá»“ng bá»™ tháº¥t báº¡i' };
    }
  }

  // â”€â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getAnalytics(startDate: string, endDate: string, adGroupId?: string, platform?: string): Promise<AdAnalyticsResponse> {
    let params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    if (adGroupId) params = params.set('adGroupId', adGroupId);
    if (platform) params = params.set('platform', platform);
    return this.http.get<AdAnalyticsResponse>(
      `${this.apiUrl}/analytics`, { params },
    ).toPromise() as Promise<AdAnalyticsResponse>;
  }

  async getSuggestions(startDate: string, endDate: string, totalBudget: number): Promise<AdSuggestionResponse> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('totalBudget', String(totalBudget));
    return this.http.get<AdSuggestionResponse>(
      `${this.apiUrl}/suggestions`, { params },
    ).toPromise() as Promise<AdSuggestionResponse>;
  }
}
