import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";
export type DeliveryStatus =
  | "QUEUED"
  | "SENT_TO_PROVIDER"
  | "DELIVERED"
  | "FAILED"
  | "RETRYING"
  | "UNDELIVERABLE";

export type DispatchNotificationInput = {
  notificationId: string;
  tenantId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  targetAddress?: string;
};

export type DispatchNotificationResult = {
  provider: string;
  providerMessageId: string;
  deliveryStatus: "SENT_TO_PROVIDER" | "DELIVERED";
};

@Injectable()
export class NotificationGatewayService {
  constructor(private readonly configService: ConfigService) {}

  async dispatch(payload: DispatchNotificationInput): Promise<DispatchNotificationResult> {
    if (payload.channel === "IN_APP") {
      return {
        provider: "IN_APP",
        providerMessageId: `inapp-${payload.notificationId}`,
        deliveryStatus: "DELIVERED"
      };
    }

    if (!payload.targetAddress?.trim()) {
      throw new Error(`Missing target address for ${payload.channel} notification.`);
    }

    const channel = payload.channel.toUpperCase() as "EMAIL" | "SMS";
    const providerMode = this.resolveProviderMode(channel);

    if (providerMode === "MOCK") {
      return {
        provider: `MOCK_${channel}`,
        providerMessageId: `mock-${channel.toLowerCase()}-${randomUUID().slice(0, 12)}`,
        deliveryStatus: "DELIVERED"
      };
    }

    if (providerMode !== "WEBHOOK") {
      throw new Error(`Unsupported ${channel} provider mode: ${providerMode}.`);
    }

    return this.dispatchWithWebhook(channel, payload);
  }

  private resolveProviderMode(channel: "EMAIL" | "SMS"): string {
    const key = channel === "EMAIL" ? "NOTIFY_EMAIL_PROVIDER" : "NOTIFY_SMS_PROVIDER";
    return this.configService.get<string>(key, "MOCK").trim().toUpperCase();
  }

  private async dispatchWithWebhook(
    channel: "EMAIL" | "SMS",
    payload: DispatchNotificationInput
  ): Promise<DispatchNotificationResult> {
    const urlKey = channel === "EMAIL" ? "NOTIFY_EMAIL_WEBHOOK_URL" : "NOTIFY_SMS_WEBHOOK_URL";
    const tokenKey =
      channel === "EMAIL" ? "NOTIFY_EMAIL_WEBHOOK_TOKEN" : "NOTIFY_SMS_WEBHOOK_TOKEN";

    const webhookUrl = this.configService.get<string>(urlKey, "").trim();
    if (!webhookUrl) {
      throw new Error(`${urlKey} is required when provider mode is WEBHOOK.`);
    }

    const timeoutMs = Number(this.configService.get<string>("NOTIFY_WEBHOOK_TIMEOUT_MS", "8000"));
    const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
    const token = this.configService.get<string>(tokenKey, "").trim();
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), effectiveTimeoutMs);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        signal: abortController.signal,
        body: JSON.stringify({
          notificationId: payload.notificationId,
          tenantId: payload.tenantId,
          channel,
          to: payload.targetAddress,
          title: payload.title,
          message: payload.message
        })
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`${channel} webhook failed (${response.status}): ${raw.slice(0, 400)}`);
      }

      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }

      const providerMessageId =
        typeof parsed.providerMessageId === "string" && parsed.providerMessageId.trim().length > 0
          ? parsed.providerMessageId.trim()
          : `webhook-${channel.toLowerCase()}-${randomUUID().slice(0, 12)}`;

      const statusRaw =
        typeof parsed.status === "string" ? parsed.status.trim().toUpperCase() : "SENT_TO_PROVIDER";
      const deliveryStatus = statusRaw === "DELIVERED" ? "DELIVERED" : "SENT_TO_PROVIDER";

      return {
        provider:
          typeof parsed.provider === "string" && parsed.provider
            ? parsed.provider
            : `WEBHOOK_${channel}`,
        providerMessageId,
        deliveryStatus
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
