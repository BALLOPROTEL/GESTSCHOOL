import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { RATE_LIMIT_KEY, type RateLimitOptions } from "./rate-limit.decorator";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
    }>();
    const now = Date.now();
    const key = `${options.bucket}:${this.resolveClientKey(request)}`;
    const current = this.store.get(key);

    if (!current || current.resetAt <= now) {
      this.store.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      this.compact(now);
      return true;
    }

    if (current.count >= options.max) {
      throw new HttpException("Too many requests. Please retry later.", HttpStatus.TOO_MANY_REQUESTS);
    }

    current.count += 1;
    this.store.set(key, current);
    return true;
  }

  private resolveClientKey(request: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  }): string {
    const forwardedFor = request.headers?.["x-forwarded-for"];
    const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const forwardedIp = firstForwarded?.split(",")[0]?.trim();
    if (forwardedIp) {
      return forwardedIp;
    }

    const socketIp = request.socket?.remoteAddress?.trim();
    if (socketIp) {
      return socketIp;
    }

    const directIp = request.ip?.trim();
    if (directIp) {
      return directIp;
    }

    return "unknown";
  }

  private compact(now: number): void {
    if (this.store.size < 5000) {
      return;
    }

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }

    if (this.store.size <= 5000) {
      return;
    }

    let overflow = this.store.size - 5000;
    for (const key of this.store.keys()) {
      this.store.delete(key);
      overflow -= 1;
      if (overflow <= 0) {
        break;
      }
    }
  }
}
