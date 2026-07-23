import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ManagementCompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const companies = await this.prisma.managementCompany.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        _count: {
          select: {
            users: true,
            managers: true,
            parkingLots: true,
            tenants: true,
            tenantApplications: true,
            monthlyStatements: true,
          },
        },
      },
    });

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      code: company.code,
      businessNumber: company.businessNumber,
      representative: company.representative,
      contact: company.contact,
      address: company.address,
      memo: company.memo,
      isActive: company.isActive,
      users: company._count.users,
      managers: company._count.managers,
      parkingLots: company._count.parkingLots,
      tenants: company._count.tenants,
      tenantApplications: company._count.tenantApplications,
      monthlyStatements: company._count.monthlyStatements,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    }));
  }

  async findOne(companyId: string) {
    const company = await this.prisma.managementCompany.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: {
            users: true,
            managers: true,
            parkingLots: true,
            tenants: true,
            tenantApplications: true,
            monthlyStatements: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('주차장운영사를 찾을 수 없습니다.');
    }

    return {
      id: company.id,
      name: company.name,
      code: company.code,
      businessNumber: company.businessNumber,
      representative: company.representative,
      contact: company.contact,
      address: company.address,
      memo: company.memo,
      isActive: company.isActive,
      users: company._count.users,
      managers: company._count.managers,
      parkingLots: company._count.parkingLots,
      tenants: company._count.tenants,
      tenantApplications: company._count.tenantApplications,
      monthlyStatements: company._count.monthlyStatements,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  async findParkingLots(companyId: string) {
    await this.findOne(companyId);

    return this.prisma.parkingLot.findMany({
      where: { managementCompanyId: companyId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        code: true,
        region: true,
        district: true,
        address: true,
        contact: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findManagers(companyId: string) {
    await this.findOne(companyId);

    const users = await this.prisma.user.findMany({
      where: { managementCompanyId: companyId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      status: user.status,
      isApproved: user.isApproved,
      roles: user.roles.map((item) => item.role.code),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }
}
