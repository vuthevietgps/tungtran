import { Role } from './role.enum';

/** JWT payload decoded from access_token — set by JwtStrategy.validate(), available as `req.user` */
export interface JwtPayload {
  sub: string;
  _id: string;  // alias of sub, for backward compat
  userId: string; // alias of sub, for legacy modules still reading userId
  email: string;
  role: Role;
  fullName: string;
}
