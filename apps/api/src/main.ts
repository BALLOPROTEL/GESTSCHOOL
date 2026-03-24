import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>("NODE_ENV", "development").trim().toLowerCase();
  const corsOriginsRaw = configService.get<string>("CORS_ORIGINS", "").trim();
  if (nodeEnv === "production" && !corsOriginsRaw) {
    throw new Error("CORS_ORIGINS must be configured in production.");
  }
  const corsOrigins = corsOriginsRaw
    ? corsOriginsRaw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : true;

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-tenant-id",
      "x-notification-webhook-secret",
      "x-metrics-token"
    ]
  });

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const swaggerEnabled = resolveBooleanConfig(
    configService.get<string>("SWAGGER_ENABLED", nodeEnv === "production" ? "false" : "true")
  );
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("GestSchool API")
      .setDescription("Sprint 1 API contract")
      .setVersion("1.0.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        "bearer"
      )
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, swaggerDocument);
  }

  const renderPort = Number(configService.get<string>("PORT", ""));
  const configuredPort = Number(configService.get<string>("API_PORT", "3000"));
  const port = Number.isFinite(renderPort) && renderPort > 0 ? renderPort : configuredPort;
  await app.listen(port);
}

function resolveBooleanConfig(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

void bootstrap();
