import { Injectable } from '@nestjs/common';
import { Locale, ProjectArea } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const STARTER_NAMES: Record<Locale, { work: string; personal: string }> = {
  en: { work: 'Work', personal: 'Personal' },
  ru: { work: 'Работа', personal: 'Личное' },
  uk: { work: 'Робота', personal: 'Особисте' },
};

@Injectable()
export class StarterProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(userId: string, locale: Locale): Promise<void> {
    const count = await this.prisma.project.count({ where: { userId } });

    if (count > 0) {
      return;
    }

    const names = STARTER_NAMES[locale];

    await this.prisma.project.createMany({
      data: [
        { userId, name: names.work, code: 'WORK', area: ProjectArea.WORK, position: 0 },
        { userId, name: names.personal, code: 'LIFE', area: ProjectArea.PERSONAL, position: 1 },
      ],
    });
  }
}
