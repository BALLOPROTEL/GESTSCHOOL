import { Controller, ForbiddenException, Get, Header, Headers } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../infrastructure/redis/redis.service";
import { NOTIFICATION_REQUESTED } from "../notifications/notification-request.contract";
import { RequestMetricsService } from "../observability/request-metrics.service";
import { Public } from "../security/public.decorator";
import { RateLimit } from "../security/rate-limit.decorator";

@ApiTags("monitoring")
@Controller("monitoring")
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly requestMetrics: RequestMetricsService
  ) {}

  @Public()
  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @RateLimit({ bucket: "monitoring-metrics", max: 60, windowMs: 60_000 })
  @ApiOperation({ summary: "Prometheus-like metrics endpoint" })
  async metrics(@Headers("x-metrics-token") tokenHeader?: string): Promise<string> {
    this.assertMetricsToken(tokenHeader);

    const lines: string[] = [];
    lines.push(`# generated_at ${new Date().toISOString()}`);
    lines.push("gestschool_process_uptime_seconds " + process.uptime().toFixed(2));
    lines.push("gestschool_process_heap_used_bytes " + process.memoryUsage().heapUsed);
    lines.push("gestschool_process_rss_bytes " + process.memoryUsage().rss);
    lines.push(`gestschool_redis_up ${this.redisService.isConnected() ? 1 : 0}`);

    try {
      const now = new Date();
      const [
        byStatus,
        byDelivery,
        queueDue,
        outboxByStatus,
        outboxDue,
        notificationAttemptByStatus,
        notificationCallbackCount,
        notificationCallbackByStatus,
        notificationRequestOutboxByStatus,
        oldestNotificationRequest
      ] = await Promise.all([
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
        }),
        this.prisma.outboxEvent.groupBy({
          by: ["status"],
          _count: {
            status: true
          }
        }),
        this.prisma.outboxEvent.count({
          where: {
            status: "PENDING",
            availableAt: {
              lte: now
            }
          }
        }),
        this.prisma.notificationDeliveryAttempt.groupBy({
          by: ["status"],
          _count: {
            status: true
          }
        }),
        this.prisma.notificationProviderCallback.count(),
        this.prisma.notificationProviderCallback.groupBy({
          by: ["eventStatus"],
          _count: {
            eventStatus: true
          }
        }),
        this.prisma.outboxEvent.groupBy({
          by: ["status"],
          where: {
            eventType: NOTIFICATION_REQUESTED,
            availableAt: {
              lte: now
            }
          },
          _count: {
            status: true
          }
        }),
        this.prisma.outboxEvent.findFirst({
          where: {
            eventType: NOTIFICATION_REQUESTED,
            status: "PENDING",
            availableAt: {
              lte: now
            }
          },
          orderBy: [{ createdAt: "asc" }],
          select: {
            createdAt: true
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
      for (const row of outboxByStatus) {
        lines.push(
          `gestschool_outbox_events_total{status="${this.escapeLabel(row.status)}"} ${row._count.status}`
        );
      }
      lines.push(`gestschool_outbox_events_due_total ${outboxDue}`);
      for (const row of notificationAttemptByStatus) {
        lines.push(
          `gestschool_notification_delivery_attempts_total{status="${this.escapeLabel(
            row.status
          )}"} ${row._count.status}`
        );
      }
      lines.push(`gestschool_notification_provider_callbacks_total ${notificationCallbackCount}`);
      for (const row of notificationCallbackByStatus) {
        lines.push(
          `gestschool_notification_provider_callbacks_total{event_status="${this.escapeLabel(
            row.eventStatus
          )}"} ${row._count.eventStatus}`
        );
      }
      const notificationOutboxLagSeconds = oldestNotificationRequest
        ? Math.max(0, (now.getTime() - oldestNotificationRequest.createdAt.getTime()) / 1000)
        : 0;
      let notificationRequestOutboxDue = 0;
      const notificationRequestOutboxTotals = new Map(
        notificationRequestOutboxByStatus.map((row) => [row.status, row._count.status])
      );
      for (const status of ["PENDING", "PROCESSING", "FAILED", "PROCESSED"]) {
        const count = notificationRequestOutboxTotals.get(status) ?? 0;
        if (status === "PENDING") {
          notificationRequestOutboxDue = count;
        }
        lines.push(
          `gestschool_notification_requests_outbox_total{status="${this.escapeLabel(
            status
          )}"} ${count}`
        );
      }
      lines.push(`gestschool_notification_requests_outbox_due_total ${notificationRequestOutboxDue}`);
      lines.push(
        `gestschool_notification_requests_outbox_lag_seconds_max ${notificationOutboxLagSeconds.toFixed(
          2
        )}`
      );

      const requestMetrics = this.requestMetrics.snapshot();
      for (const row of requestMetrics.total) {
        lines.push(
          `gestschool_http_requests_total{method="${this.escapeLabel(
            row.method
          )}",route="${this.escapeLabel(row.route)}",status_code="${row.statusCode}"} ${row.count}`
        );
      }
      for (const row of requestMetrics.duration) {
        lines.push(
          `gestschool_http_request_duration_ms_sum{method="${this.escapeLabel(
            row.method
          )}",route="${this.escapeLabel(row.route)}",status_code="${row.statusCode}"} ${row.totalMs}`
        );
        lines.push(
          `gestschool_http_request_duration_ms_max{method="${this.escapeLabel(
            row.method
          )}",route="${this.escapeLabel(row.route)}",status_code="${row.statusCode}"} ${row.maxMs}`
        );
      }
      lines.push("gestschool_metrics_collection_error 0");
    } catch {
      lines.push("gestschool_metrics_collection_error 1");
    }

    return `${lines.join("\n")}\n`;
  }

  private assertMetricsToken(tokenHeader?: string): void {
    const expectedToken = this.configService.get<string>("MONITORING_METRICS_TOKEN", "").trim();
    const nodeEnv = this.configService.get<string>("NODE_ENV", "development").trim().toLowerCase();
    if (!expectedToken) {
      if (nodeEnv === "production") {
        throw new ForbiddenException("Metrics endpoint is disabled.");
      }
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
