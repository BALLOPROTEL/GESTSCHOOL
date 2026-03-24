import { Body, Controller, Headers, Post, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import { CreateUploadDescriptorDto } from "./dto/storage.dto";
import { StorageService } from "./storage.service";

@ApiTags("storage")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller("storage")
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService
  ) {}

  @Post("upload-descriptor")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT, UserRole.COMPTABLE)
  @RequirePermission("attendanceAttachment", "create")
  @ApiOperation({ summary: "Create upload descriptor for external file storage" })
  createUploadDescriptor(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateUploadDescriptorDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = resolveTenantContext(this.configService, request.user, tenantHeader);
    return this.storageService.createUploadDescriptor(tenantId, body);
  }
}
