import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { resetDemoData } = await import("../src/server/policyService");
  const request = await resetDemoData();
  console.log(`Seeded Policy Checker demo request: ${request?.id}`);
  await prisma.$disconnect();
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
