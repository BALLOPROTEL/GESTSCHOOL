import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor
} from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";

import { RequestMetricsService } from "./request-metrics.service";

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly requestMetrics: RequestMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      route?: { path?: string };
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        this.requestMetrics.recordRequest({
          method: request.method || "UNKNOWN",
          route: request.route?.path || request.originalUrl || "unknown",
          statusCode: response.statusCode || 200,
          durationMs
        });
      })
    );
  }
}
