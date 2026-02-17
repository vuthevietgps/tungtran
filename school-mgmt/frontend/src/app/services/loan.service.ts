import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Loan {
  _id: string;
  loanCode: string;
  lenderName: string;
  lenderType: string;
  loanType: string;
  principal: number;
  interestRate: number;
  interestType: string;
  term: number;
  startDate: string;
  endDate: string;
  paymentFrequency: string;
  status: string;
  bankAccountId?: string;
  totalPaid: number;
  remainingBalance: number;
  collateral?: string;
  notes?: string;
  createdByName: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface LoanPayment {
  _id: string;
  paymentCode: string;
  loanId: string;
  paymentNumber: number;
  dueDate: string;
  paidDate?: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  paidByName?: string;
  createdAt: string;
}

export interface LoanSummary {
  totalDebt: number;
  totalPrincipal: number;
  activeLoanCount: number;
  overdueAmount: number;
  overdueCount: number;
  upcomingPayments30d: number;
  upcomingPaymentCount30d: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
}

@Injectable({ providedIn: 'root' })
export class LoanService {
  private apiUrl = `${environment.apiBase}/loans`;

  constructor(private http: HttpClient) {}

  async getLoans(params?: Record<string, string>): Promise<Loan[]> {
    let httpParams = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) httpParams = httpParams.set(k, v); });
    return this.http.get<Loan[]>(this.apiUrl, { params: httpParams }).toPromise() as Promise<Loan[]>;
  }

  async getLoan(id: string): Promise<Loan> {
    return this.http.get<Loan>(`${this.apiUrl}/${id}`).toPromise() as Promise<Loan>;
  }

  async getSummary(): Promise<LoanSummary> {
    return this.http.get<LoanSummary>(`${this.apiUrl}/summary`).toPromise() as Promise<LoanSummary>;
  }

  async createLoan(data: any): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      const result = await this.http.post(this.apiUrl, data).toPromise();
      return { ok: true, data: result };
    } catch (err: any) { return { ok: false, message: err.error?.message || 'Tạo khoản vay thất bại' }; }
  }

  async updateLoan(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.patch(`${this.apiUrl}/${id}`, data).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Cập nhật thất bại' }; }
  }

  async activateLoan(id: string): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.post(`${this.apiUrl}/${id}/activate`, {}).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Kích hoạt thất bại' }; }
  }

  async getPayments(params?: Record<string, string>): Promise<LoanPayment[]> {
    let httpParams = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) httpParams = httpParams.set(k, v); });
    return this.http.get<LoanPayment[]>(`${this.apiUrl}/payments/list`, { params: httpParams }).toPromise() as Promise<LoanPayment[]>;
  }

  async recordPayment(data: any): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.post(`${this.apiUrl}/payments/record`, data).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Ghi nhận thanh toán thất bại' }; }
  }

  async updateOverdue(): Promise<{ ok: boolean; message?: string }> {
    try { await this.http.post(`${this.apiUrl}/update-overdue`, {}).toPromise(); return { ok: true }; }
    catch (err: any) { return { ok: false, message: err.error?.message || 'Cập nhật quá hạn thất bại' }; }
  }
}
