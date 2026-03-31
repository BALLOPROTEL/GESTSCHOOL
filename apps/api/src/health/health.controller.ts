import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../infrastructure/redis/redis.service";
import { Public } from "../security/public.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Basic liveness endpoint" })
  getHealth(): { status: string; service: string; timestamp: string } {
    return {
      status: "ok",
      service: "gestschool-api",
      timestamp: new Date().toISOString()
    };
  }

  @Public()
  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  getLiveness(): { status: string; uptimeSeconds: number } {
    return {
      status: "live",
      uptimeSeconds: Number(process.uptime().toFixed(2))
    };
  }

  @Public()
  @Get("ready")
  @ApiOperation({ summary: "Readiness probe with database and Redis checks" })
  async getReadiness(): Promise<{
    status: string;
    database: string;
    redis: string;
    timestamp: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const redisConfigured = this.redisService.isConfigured();
      const redisUp = !redisConfigured || (await this.redisService.ping());
      if (!redisUp) {
        throw new ServiceUnavailableException("Redis is not ready.");
      }

      return {
        status: "ready",
        database: "up",
        redis: redisConfigured ? "up" : "disabled",
        timestamp: new Date().toISOString()
      };
    } catch {
      throw new ServiceUnavailableException("Dependencies are not ready.");
    }
  }
}
