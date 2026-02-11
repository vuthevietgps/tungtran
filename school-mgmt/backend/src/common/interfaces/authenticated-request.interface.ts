import { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface';

/**
 * Express Request with typed `user` property.
 * Use in controllers protected by JwtAuthGuard — the guard guarantees `user` is always set.
 */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
