import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "../database/prisma.service";
import { Public } from "../security/public.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
  @ApiOperation({ summary: "Readiness probe with database check" })
  async getReadiness(): Promise<{ status: string; database: string; timestamp: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ready",
        database: "up",
        timestamp: new Date().toISOString()
      };
    } catch {
      throw new ServiceUnavailableException("Database is not ready.");
    }
  }
}
