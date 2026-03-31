import { Injectable } from "@nestjs/common";

type RequestMetricSnapshot = {
  total: Array<{
    method: string;
    route: string;
    statusCode: number;
    count: number;
  }>;
  duration: Array<{
    method: string;
    route: string;
    statusCode: number;
    count: number;
    totalMs: number;
    maxMs: number;
  }>;
};

type Aggregate = {
  count: number;
  totalMs: number;
  maxMs: number;
};

@Injectable()
export class RequestMetricsService {
  private readonly aggregates = new Map<string, Aggregate>();

  recordRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    const key = this.keyOf(input.method, input.route, input.statusCode);
    const current = this.aggregates.get(key) || { count: 0, totalMs: 0, maxMs: 0 };

    current.count += 1;
    current.totalMs += input.durationMs;
    current.maxMs = Math.max(current.maxMs, input.durationMs);
    this.aggregates.set(key, current);
  }

  snapshot(): RequestMetricSnapshot {
    const total: RequestMetricSnapshot["total"] = [];
    const duration: RequestMetricSnapshot["duration"] = [];

    for (const [key, aggregate] of this.aggregates.entries()) {
      const [method, route, rawStatusCode] = key.split("|");
      const statusCode = Number(rawStatusCode);

      total.push({
        method,
        route,
        statusCode,
        count: aggregate.count
      });
      duration.push({
        method,
        route,
        statusCode,
        count: aggregate.count,
        totalMs: Number(aggregate.totalMs.toFixed(2)),
        maxMs: Number(aggregate.maxMs.toFixed(2))
      });
    }

    return { total, duration };
  }

  private keyOf(method: string, route: string, statusCode: number): string {
    return [method.toUpperCase(), route || "unknown", statusCode].join("|");
  }
}
