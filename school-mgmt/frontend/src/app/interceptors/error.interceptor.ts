import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

/**
 * Global error interceptor: handles auth errors and redirects to login.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401) {
          // 401 = not authenticated → clear session and redirect to login
          auth.userSignal.set(null);
          if (!router.url.startsWith('/login')) {
            router.navigate(['/login']);
          }
        }
        // 403 = Forbidden (authenticated but no permission) → let caller handle
      }
      return throwError(() => err);
    }),
  );
};
