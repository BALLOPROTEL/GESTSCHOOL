import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Student } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";

export type StudentView = {
  id: string;
  tenantId: string;
  matricule: string;
  firstName: string;
  lastName: string;
  sex: "M" | "F";
  birthDate?: string;
};

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<StudentView[]> {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });

    return students.map((student) => this.toView(student));
  }

  async getById(tenantId: string, id: string): Promise<StudentView> {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    return this.toView(student);
  }

  async create(tenantId: string, payload: CreateStudentDto): Promise<StudentView> {
    try {
      const student = await this.prisma.student.create({
        data: {
          tenantId,
          matricule: payload.matricule,
          firstName: payload.firstName,
          lastName: payload.lastName,
          sex: payload.sex,
          birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
          updatedAt: new Date()
        }
      });

      return this.toView(student);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Matricule already exists for this tenant.");
      }

      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    payload: UpdateStudentDto
  ): Promise<StudentView> {
    const existing = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!existing) {
      throw new NotFoundException("Student not found.");
    }

    try {
      const updated = await this.prisma.student.update({
        where: { id: existing.id },
        data: {
          matricule: payload.matricule ?? undefined,
          firstName: payload.firstName ?? undefined,
          lastName: payload.lastName ?? undefined,
          sex: payload.sex ?? undefined,
          birthDate:
            payload.birthDate !== undefined ? new Date(payload.birthDate) : undefined,
          updatedAt: new Date()
        }
      });

      return this.toView(updated);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Matricule already exists for this tenant.");
      }

      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.student.updateMany({
      where: {
        id,
        tenantId,
        deletedAt: null
      },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });

    if (result.count === 0) {
      throw new NotFoundException("Student not found.");
    }
  }

  private toView(student: Student): StudentView {
    return {
      id: student.id,
      tenantId: student.tenantId,
      matricule: student.matricule,
      firstName: student.firstName,
      lastName: student.lastName,
      sex: student.sex as "M" | "F",
      birthDate: student.birthDate?.toISOString().slice(0, 10)
    };
  }
}
