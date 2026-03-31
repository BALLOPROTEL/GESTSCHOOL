import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { RedisService } from "../infrastructure/redis/redis.service";
import { RATE_LIMIT_KEY, type RateLimitOptions } from "./rate-limit.decorator";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isDisabledForCurrentProcess()) {
      return true;
    }

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
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: number | string): void;
    }>();
    const now = Date.now();
    const key = `${options.bucket}:${this.resolveClientKey(request)}`;

    const distributedCount = await this.redisService.incrementWithExpiry(key, options.windowMs);
    if (distributedCount !== null) {
      this.applyHeaders(response, options, distributedCount);
      if (distributedCount > options.max) {
        throw new HttpException(
          "Too many requests. Please retry later.",
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      return true;
    }

    const current = this.store.get(key);

    if (!current || current.resetAt <= now) {
      this.store.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      this.compact(now);
      this.applyHeaders(response, options, 1);
      return true;
    }

    if (current.count >= options.max) {
      this.applyHeaders(response, options, current.count);
      throw new HttpException("Too many requests. Please retry later.", HttpStatus.TOO_MANY_REQUESTS);
    }

    current.count += 1;
    this.store.set(key, current);
    this.applyHeaders(response, options, current.count);
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

  private isDisabledForCurrentProcess(): boolean {
    const value = (process.env.RATE_LIMIT_DISABLED || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes";
  }

  private applyHeaders(
    response: { setHeader(name: string, value: number | string): void },
    options: RateLimitOptions,
    count: number
  ): void {
    response.setHeader("x-ratelimit-limit", options.max);
    response.setHeader("x-ratelimit-remaining", Math.max(0, options.max - count));
    response.setHeader("x-ratelimit-window-ms", options.windowMs);
  }
}
