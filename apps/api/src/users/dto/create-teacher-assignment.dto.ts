import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class CreateTeacherAssignmentDto {
  @ApiProperty({
    example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    description: "User id with ENSEIGNANT role"
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: "3fa85f64-5717-4562-b3fc-2c963f66afb7" })
  @IsUUID()
  classId!: string;

  @ApiProperty({ example: "3fa85f64-5717-4562-b3fc-2c963f66afc8" })
  @IsUUID()
  schoolYearId!: string;

  @ApiPropertyOptional({
    example: "3fa85f64-5717-4562-b3fc-2c963f66afd9",
    description: "Optional subject scope for this assignment"
  })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
