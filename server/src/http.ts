import type { NextFunction, Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Lets async route handlers throw instead of calling next(err). */
export const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message) });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ message: `Invalid ${err.path}` });
  if ((err as { code?: number }).code === 11000) return res.status(409).json({ message: "That record already exists." });
  console.error(err);
  res.status(500).json({ message: "Something went wrong." });
}

export function assertId(id: unknown, label = "id"): string {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`);
  return id;
}

export const num = (value: unknown, label: string, { min = 0 } = {}) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw new HttpError(400, `${label} must be a number of at least ${min}.`);
  return n;
};

export const str = (value: unknown, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : undefined;
