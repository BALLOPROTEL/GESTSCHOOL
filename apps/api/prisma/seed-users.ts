import { hash } from "bcryptjs";

import { PrismaClient } from "@prisma/client";

import { getDefaultDevUsers } from "../src/database/dev-default-users";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tenantId =
    process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

  const users = getDefaultDevUsers();

  for (const user of users) {
    const passwordHash = await hash(user.password, 10);
    await prisma.user.upsert({
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
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("seed:users failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
