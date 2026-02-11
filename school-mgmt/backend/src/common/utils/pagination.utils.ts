/**
 * Shared pagination utilities for consistent paginated query handling
 */

export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Parse and normalize pagination parameters
 * @param params Raw pagination params from query
 * @param maxLimit Maximum allowed limit (default: 100)
 * @returns Normalized pagination with page, limit, skip
 */
export function parsePagination(
  params: PaginationParams,
  maxLimit: number = 100,
): PaginationResult {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(Number(params.limit) || 20, maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build pagination metadata for response
 * @param page Current page number
 * @param limit Items per page
 * @param total Total items count
 * @returns Pagination metadata
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
