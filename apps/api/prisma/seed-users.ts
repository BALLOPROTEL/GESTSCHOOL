import { hash } from "bcryptjs";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tenantId =
    process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

  const users = [
    {
      username: process.env.ADMIN_USERNAME || "admin@gestschool.local",
      password: process.env.ADMIN_PASSWORD || "admin12345",
      role: "ADMIN"
    },
    {
      username: process.env.SCOLARITE_USERNAME || "scolarite@gestschool.local",
      password: process.env.SCOLARITE_PASSWORD || "scolarite123",
      role: "SCOLARITE"
    },
    {
      username: process.env.COMPTABLE_USERNAME || "comptable@gestschool.local",
      password: process.env.COMPTABLE_PASSWORD || "comptable123",
      role: "COMPTABLE"
    },
    {
      username: process.env.ENSEIGNANT_USERNAME || "enseignant@gestschool.local",
      password: process.env.ENSEIGNANT_PASSWORD || "teacher1234",
      role: "ENSEIGNANT"
    },
    {
      username: process.env.PARENT_USERNAME || "parent@gestschool.local",
      password: process.env.PARENT_PASSWORD || "parent1234",
      role: "PARENT"
    }
  ] as const;

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
