import { BadRequestException } from '@nestjs/common';

/**
 * Shared date utilities for consistent date handling across the application.
 * All dates are normalized to UTC midnight to prevent timezone drift issues.
 */

/**
 * Parse YYYY-MM-DD string to UTC midnight — timezone-safe, no drift
 * @param dateStr Date string in YYYY-MM-DD format or ISO format
 * @returns Date object set to UTC midnight
 */
export function normalizeDate(dateStr: string): Date {
  if (typeof dateStr !== 'string' || !dateStr.trim()) {
    throw new BadRequestException('Ngay khong hop le');
  }

  const d = dateStr.trim().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new BadRequestException('Ngay phai dung dinh dang YYYY-MM-DD');
  }

  const [y, m, day] = d.split('-').map(Number);
  const normalized = new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0));

  if (
    Number.isNaN(normalized.getTime()) ||
    normalized.getUTCFullYear() !== y ||
    normalized.getUTCMonth() !== m - 1 ||
    normalized.getUTCDate() !== day
  ) {
    throw new BadRequestException('Gia tri ngay khong hop le');
  }

  return normalized;
}

/**
 * Create date range covering one full UTC day
 * @param date Input date
 * @returns Range object with $gte (start of day) and $lt (end of day)
 */
export function dayRange(date: Date): { $gte: Date; $lt: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { $gte: start, $lt: end };
}

/**
 * Build MongoDB date filter from optional fromDate/toDate strings
 * @param fromDate Optional start date (YYYY-MM-DD)
 * @param toDate Optional end date (YYYY-MM-DD)
 * @returns MongoDB filter object or undefined
 */
export function buildDateFilter(fromDate?: string, toDate?: string): any {
  if (!fromDate && !toDate) return undefined;
  
  const filter: any = {};
  if (fromDate) {
    const start = normalizeDate(fromDate);
    filter.$gte = start;
  }
  if (toDate) {
    const end = normalizeDate(toDate);
    end.setUTCDate(end.getUTCDate() + 1); // Include full end date
    filter.$lt = end;
  }
  return filter;
}

/**
 * Get UTC start and end of today
 */
export function getToday(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
