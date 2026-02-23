import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escapedName = name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Auth uses cookie credentials; always send cookies.
  let updatedReq = req.clone({ withCredentials: true });

  const method = updatedReq.method.toUpperCase();
  const isUnsafeMethod = !SAFE_METHODS.has(method);
  const isApiRequest = updatedReq.url.startsWith(environment.apiBase);
  const hasXsrfHeader = updatedReq.headers.has('X-XSRF-TOKEN');

  // Ensure CSRF header is present for API calls from localhost:4200 -> localhost:3000.
  if (isApiRequest && isUnsafeMethod && !hasXsrfHeader) {
    const token = getCookieValue('XSRF-TOKEN');
    if (token) {
      updatedReq = updatedReq.clone({ setHeaders: { 'X-XSRF-TOKEN': token } });
    }
  }

  return next(updatedReq);
};
