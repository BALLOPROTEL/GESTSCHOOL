import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CreateUploadDescriptorDto } from "./dto/storage.dto";

type StorageDriver = "LOCAL" | "S3" | "WEBHOOK";

export type UploadDescriptorView = {
  driver: StorageDriver;
  tenantId: string;
  fileName: string;
  mimeType: string;
  key: string;
  uploadUrl: string;
  fileUrl: string;
  expiresAt: string;
};

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  createUploadDescriptor(
    tenantId: string,
    payload: CreateUploadDescriptorDto
  ): UploadDescriptorView {
    const driver = this.resolveDriver();
    const sanitizedFileName = this.sanitizeFileName(payload.fileName);
    const folder = this.sanitizeFolder(payload.folder);
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const key = `${tenantId}/${folder}/${yyyy}/${mm}/${randomUUID().slice(0, 12)}-${sanitizedFileName}`;

    const baseUrl = this.configService
      .get<string>("FILE_STORAGE_BASE_URL", "http://localhost:3000/files")
      .trim()
      .replace(/\/+$/, "");
    const fileUrl = `${baseUrl}/${key}`;

    let uploadUrl = fileUrl;
    if (driver === "S3") {
      const bucket = this.configService.get<string>("FILE_STORAGE_S3_BUCKET", "gestschool");
      uploadUrl = `s3://${bucket}/${key}`;
    }
    if (driver === "WEBHOOK") {
      uploadUrl = this.configService.get<string>("FILE_STORAGE_PRESIGN_ENDPOINT", "").trim();
    }

    return {
      driver,
      tenantId,
      fileName: payload.fileName.trim(),
      mimeType: payload.mimeType?.trim() || "application/octet-stream",
      key,
      uploadUrl,
      fileUrl,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString()
    };
  }

  private resolveDriver(): StorageDriver {
    const normalized = this.configService
      .get<string>("FILE_STORAGE_DRIVER", "LOCAL")
      .trim()
      .toUpperCase();
    if (normalized === "S3") return "S3";
    if (normalized === "WEBHOOK") return "WEBHOOK";
    return "LOCAL";
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 140);
  }

  private sanitizeFolder(folder: string | undefined): string {
    const base = (folder || "general").trim().toLowerCase();
    const sanitized = base
      .replace(/[^a-z0-9/\-_]+/g, "-")
      .replace(/\/+/g, "/")
      .replace(/^-|-$/g, "");
    return sanitized || "general";
  }
}
