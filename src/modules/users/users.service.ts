import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateUserDto } from './dto/update-user.dto';
import { toUserDto, type UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserDto> {
    return toUserDto(await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  }

  async update(userId: string, dto: UpdateUserDto): Promise<UserDto> {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const dayStartMinutes = dto.dayStartMinutes ?? current.dayStartMinutes;
    const dayEndMinutes = dto.dayEndMinutes ?? current.dayEndMinutes;

    if (dayEndMinutes <= dayStartMinutes) {
      throw new BadRequestException('The day must end after it starts');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName === undefined ? undefined : dto.displayName.trim() || null,
        locale: dto.locale,
        timezone: dto.timezone,
        dayStartMinutes,
        dayEndMinutes,
        onboardedAt: dto.onboarded === undefined ? undefined : dto.onboarded ? new Date() : null,
      },
    });

    return toUserDto(user);
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
