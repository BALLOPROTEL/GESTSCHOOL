import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hash } from "bcryptjs";

import { getDefaultDevUsers } from "./dev-default-users";
import { PrismaService } from "./prisma.service";

@Injectable()
export class DevBootstrapUsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevBootstrapUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.shouldBootstrap()) return;

    const tenantId =
      this.configService.get<string>("DEFAULT_TENANT_ID") ||
      "00000000-0000-0000-0000-000000000001";
    const users = getDefaultDevUsers();

    for (const user of users) {
      const passwordHash = await hash(user.password, 10);
      await this.prisma.user.upsert({
        where: {
          tenantId_username: {
            tenantId,
            username: user.username
          }
        },
        create: {
          tenantId,
          username: user.username,
          passwordHash,
          role: user.role
        },
        update: {
          passwordHash,
          role: user.role,
          isActive: true,
          deletedAt: null,
          updatedAt: new Date()
        }
      });
    }

    this.logger.log(`Comptes locaux de demonstration verifies pour ${tenantId}.`);
  }

  private shouldBootstrap(): boolean {
    if (this.configService.get<string>("DEV_BOOTSTRAP_USERS_ON_START", "true") === "false") {
      return false;
    }

    const nodeEnv = this.configService.get<string>("NODE_ENV", "development");
    if (nodeEnv === "production") return false;

    if (process.env.CI === "true") return false;
    if (process.env.JEST_WORKER_ID) return false;

    return true;
  }
}
