import { randomUUID } from "node:crypto";

import { Injectable, type NestMiddleware } from "@nestjs/common";

type RequestWithContext = {
  header(name: string): string | undefined;
  requestId?: string;
};

type ResponseWithHeaders = {
  setHeader(name: string, value: string): void;
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(
    request: RequestWithContext,
    response: ResponseWithHeaders,
    next: () => void
  ): void {
    const headerValue = request.header("x-request-id")?.trim();
    const requestId = headerValue || randomUUID();

    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  }
}
