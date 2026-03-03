import { Controller, ForbiddenException, Get, Header, Headers } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "../database/prisma.service";
import { Public } from "../security/public.decorator";

@ApiTags("monitoring")
@Controller("monitoring")
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  @Public()
  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @ApiOperation({ summary: "Prometheus-like metrics endpoint" })
  async metrics(@Headers("x-metrics-token") tokenHeader?: string): Promise<string> {
    this.assertMetricsToken(tokenHeader);

    const lines: string[] = [];
    lines.push(`# generated_at ${new Date().toISOString()}`);
    lines.push("gestschool_process_uptime_seconds " + process.uptime().toFixed(2));
    lines.push("gestschool_process_heap_used_bytes " + process.memoryUsage().heapUsed);
    lines.push("gestschool_process_rss_bytes " + process.memoryUsage().rss);

    try {
      const now = new Date();
      const [byStatus, byDelivery, queueDue] = await Promise.all([
        this.prisma.notification.groupBy({
          by: ["status"],
          _count: {
            status: true
          }
        }),
        this.prisma.notification.groupBy({
          by: ["deliveryStatus"],
          _count: {
            deliveryStatus: true
          }
        }),
        this.prisma.notification.count({
          where: {
            status: {
              in: ["PENDING", "SCHEDULED"]
            },
            OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
            AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }]
          }
        })
      ]);

      for (const row of byStatus) {
        lines.push(
          `gestschool_notifications_total{status="${this.escapeLabel(row.status)}"} ${row._count.status}`
        );
      }

      for (const row of byDelivery) {
        lines.push(
          `gestschool_notifications_delivery_total{delivery_status="${this.escapeLabel(
            row.deliveryStatus
          )}"} ${row._count.deliveryStatus}`
        );
      }

      lines.push(`gestschool_notifications_queue_due_total ${queueDue}`);
      lines.push("gestschool_metrics_collection_error 0");
    } catch {
      lines.push("gestschool_metrics_collection_error 1");
    }

    return `${lines.join("\n")}\n`;
  }

  private assertMetricsToken(tokenHeader?: string): void {
    const expectedToken = this.configService.get<string>("MONITORING_METRICS_TOKEN", "").trim();
    if (!expectedToken) {
      return;
    }
    if (!tokenHeader || tokenHeader.trim() !== expectedToken) {
      throw new ForbiddenException("Invalid metrics token.");
    }
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
}
