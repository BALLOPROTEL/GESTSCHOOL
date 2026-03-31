import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: ReturnType<typeof createClient> | null = null;
  private status: "disabled" | "connecting" | "connected" | "degraded" = "disabled";

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.getRedisUrl();
    if (!redisUrl) {
      this.status = "disabled";
      return;
    }

    this.status = "connecting";
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 3_000,
        reconnectStrategy: (retries) => Math.min(retries * 200, 2_000)
      }
    });

    client.on("error", (error) => {
      const message = error instanceof Error ? error.message : "Redis client error";
      if (this.status !== "degraded") {
        this.logger.warn(`Redis degraded: ${message}`);
      }
      this.status = "degraded";
    });

    client.on("ready", () => {
      this.status = "connected";
      this.logger.log("Redis client connected.");
    });

    client.on("end", () => {
      if (this.status !== "disabled") {
        this.status = "degraded";
      }
    });

    try {
      await client.connect();
      this.client = client;
      this.status = "connected";
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to connect to Redis";
      this.logger.warn(`Redis unavailable at startup: ${message}`);
      this.status = "degraded";
      this.client = client;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      if (this.client.isOpen) {
        await this.client.quit();
      }
    } catch {
      this.client.destroy();
    } finally {
      this.client = null;
      this.status = this.getRedisUrl() ? "degraded" : "disabled";
    }
  }

  isConfigured(): boolean {
    return this.getRedisUrl().length > 0;
  }

  isConnected(): boolean {
    return this.status === "connected" && this.client?.isReady === true;
  }

  getStatus(): "disabled" | "connecting" | "connected" | "degraded" {
    return this.status;
  }

  async ping(): Promise<boolean> {
    const client = this.getAvailableClient();
    if (!client) {
      return false;
    }

    try {
      return (await client.ping()) === "PONG";
    } catch {
      this.status = "degraded";
      return false;
    }
  }

  async incrementWithExpiry(key: string, windowMs: number): Promise<number | null> {
    const client = this.getAvailableClient();
    if (!client) {
      return null;
    }

    try {
      const namespacedKey = this.qualifyKey(key);
      const count = await client.incr(namespacedKey);
      if (count === 1) {
        await client.pExpire(namespacedKey, windowMs);
      }
      return count;
    } catch {
      this.status = "degraded";
      return null;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const client = this.getAvailableClient();
    if (!client) {
      return null;
    }

    try {
      const value = await client.get(this.qualifyKey(key));
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch {
      this.status = "degraded";
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<boolean> {
    const client = this.getAvailableClient();
    if (!client) {
      return false;
    }

    try {
      await client.set(this.qualifyKey(key), JSON.stringify(value), {
        PX: Math.max(1_000, ttlMs)
      });
      return true;
    } catch {
      this.status = "degraded";
      return false;
    }
  }

  private getAvailableClient(): ReturnType<typeof createClient> | null {
    if (!this.client || !this.client.isOpen || !this.client.isReady) {
      return null;
    }
    return this.client;
  }

  private qualifyKey(key: string): string {
    const prefix = this.configService.get<string>("REDIS_KEY_PREFIX", "gestschool").trim();
    return `${prefix}:${key}`;
  }

  private getRedisUrl(): string {
    return this.configService.get<string>("REDIS_URL", "").trim();
  }
}
