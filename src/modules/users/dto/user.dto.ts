import { ApiProperty } from '@nestjs/swagger';
import { Locale, type User } from '@prisma/client';

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ enum: Locale })
  locale!: Locale;

  @ApiProperty({ example: 'Europe/Kyiv' })
  timezone!: string;

  @ApiProperty({ description: 'Start of the working day in minutes after midnight' })
  dayStartMinutes!: number;

  @ApiProperty({ description: 'End of the working day in minutes after midnight' })
  dayEndMinutes!: number;

  @ApiProperty()
  hasPassword!: boolean;

  @ApiProperty()
  googleLinked!: boolean;

  @ApiProperty({ description: 'Whether the first run guide was finished or skipped' })
  onboarded!: boolean;

  @ApiProperty()
  createdAt!: string;
}

export const toUserDto = (user: User): UserDto => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  locale: user.locale,
  timezone: user.timezone,
  dayStartMinutes: user.dayStartMinutes,
  dayEndMinutes: user.dayEndMinutes,
  hasPassword: user.passwordHash !== null,
  googleLinked: user.googleId !== null,
  onboarded: user.onboardedAt !== null,
  createdAt: user.createdAt.toISOString(),
});
