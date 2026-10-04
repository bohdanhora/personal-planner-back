import { ApiProperty } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty({ nullable: true, type: String })
  googleClientId!: string | null;
}
