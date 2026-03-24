import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_KEY = "rate-limit";

export type RateLimitOptions = {
  bucket: string;
  max: number;
  windowMs: number;
};

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
