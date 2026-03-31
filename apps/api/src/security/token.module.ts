import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>("JWT_SECRET", "dev-only-secret-change-me"),
        signOptions: {
          issuer: configService.get<string>("JWT_ISSUER", "gestschool"),
          audience: configService.get<string>("JWT_AUDIENCE", "gestschool-clients")
        }
      })
    })
  ],
  exports: [JwtModule]
})
export class TokenModule {}
