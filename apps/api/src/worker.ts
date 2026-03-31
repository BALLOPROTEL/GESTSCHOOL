import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { WorkerModule } from "./worker.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true
  });

  app.flushLogs();
  app.enableShutdownHooks();
  Logger.log("GestSchool worker started.", "WorkerBootstrap");
}

void bootstrap();
