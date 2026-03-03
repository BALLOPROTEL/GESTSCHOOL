import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, ValidateNested } from "class-validator";

import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  type PermissionAction,
  type PermissionResource
} from "../../security/permissions.types";

const PERMISSION_RESOURCE_VALUES = [...PERMISSION_RESOURCES];
const PERMISSION_ACTION_VALUES = [...PERMISSION_ACTIONS];

export class RolePermissionItemDto {
  @ApiProperty({ enum: PERMISSION_RESOURCE_VALUES })
  @IsIn(PERMISSION_RESOURCE_VALUES)
  resource!: PermissionResource;

  @ApiProperty({ enum: PERMISSION_ACTION_VALUES })
  @IsIn(PERMISSION_ACTION_VALUES)
  action!: PermissionAction;

  @ApiProperty({ example: true })
  @IsBoolean()
  allowed!: boolean;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({
    type: [RolePermissionItemDto],
    example: [{ resource: "students", action: "read", allowed: false }]
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RolePermissionItemDto)
  permissions!: RolePermissionItemDto[];
}
