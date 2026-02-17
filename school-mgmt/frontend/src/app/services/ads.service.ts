import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

// ─── Interfaces ───────────────────────────────────────────

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
  suggestedDailySpend: number | null;
  expectedOrders: number | null;
  expectedRevenue: number | null;
  expectedCostPerOrder: number | null;
  changePercent: number | null;
  confidence: string;
  dataPoints: number;
}

export interface AdSuggestionResponse {
  totalBudget: number;
  allocated: number;
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

  // ─── Ad Accounts ────────────────────────────────────────

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
      return { ok: false, message: err.error?.message || 'Tạo tài khoản thất bại' };
    }
  }

  async updateAccount(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/accounts/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cập nhật thất bại' };
    }
  }

  async deleteAccount(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/accounts/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Xóa thất bại' };
    }
  }

  // ─── Ad Groups ──────────────────────────────────────────

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
      return { ok: false, message: err.error?.message || 'Tạo nhóm QC thất bại' };
    }
  }

  async updateGroup(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/groups/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cập nhật thất bại' };
    }
  }

  async deleteGroup(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/groups/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Xóa thất bại' };
    }
  }

  // ─── API Tokens ─────────────────────────────────────────

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
      return { ok: false, message: err.error?.message || 'Tạo token thất bại' };
    }
  }

  async updateToken(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/tokens/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cập nhật thất bại' };
    }
  }

  async deleteToken(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/tokens/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Xóa thất bại' };
    }
  }

  // ─── Ad Costs ───────────────────────────────────────────

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
      return { ok: false, message: err.error?.message || 'Tạo chi phí thất bại' };
    }
  }

  async deleteCost(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/costs/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Xóa thất bại' };
    }
  }

  async triggerSync(accountId?: string): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      const url = accountId ? `${this.apiUrl}/sync/${accountId}` : `${this.apiUrl}/sync`;
      const result = await this.http.post<any>(url, {}).toPromise();
      return { ok: true, data: result };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Đồng bộ thất bại' };
    }
  }

  // ─── Analytics ──────────────────────────────────────────

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
