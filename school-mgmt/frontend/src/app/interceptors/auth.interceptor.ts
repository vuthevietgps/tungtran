import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Use httpOnly cookies for auth — just ensure withCredentials is set
  req = req.clone({ withCredentials: true });
  return next(req);
};
