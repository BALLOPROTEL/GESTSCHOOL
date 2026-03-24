import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateStudentDto {
  @ApiPropertyOptional({ example: "MAT-26-002" })
  @IsOptional()
  @IsString()
  matricule?: string;

  @ApiPropertyOptional({ example: "Mariam" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Traore" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: "F", enum: ["M", "F"] })
  @IsOptional()
  @IsIn(["M", "F"])
  sex?: "M" | "F";

  @ApiPropertyOptional({ example: "2014-10-02" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;
}
