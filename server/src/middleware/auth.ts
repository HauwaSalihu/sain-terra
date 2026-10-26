import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { HttpError } from "../http";
import { User, type UserDoc } from "../models";
import { can, type Permission } from "../../../lib/roles";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

/**
 * Verifies the bearer token and reloads the user on every request, so a
 * disabled account or changed role takes effect immediately.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new HttpError(401, "Please sign in.");
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, "Your session has expired. Please sign in again.");
    }
    const user = await User.findById(payload.sub).lean<UserDoc>();
    if (!user || !user.active) throw new HttpError(401, "This account is not active.");
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export const requirePermission =
  (permission: Permission) => (req: Request, _res: Response, next: NextFunction) => {
    if (!can(req.user?.role, permission)) {
      return next(new HttpError(403, "Your role does not allow this action."));
    }
    next();
  };
