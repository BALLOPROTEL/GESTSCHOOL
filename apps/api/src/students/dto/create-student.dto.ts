import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class CreateStudentDto {
  @ApiProperty({ example: "MAT-26-001" })
  @IsString()
  matricule!: string;

  @ApiProperty({ example: "Mariam" })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: "Traore" })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: "F", enum: ["M", "F"] })
  @IsIn(["M", "F"])
  sex!: "M" | "F";

  @ApiProperty({ required: false, example: "2014-10-02" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;
}
