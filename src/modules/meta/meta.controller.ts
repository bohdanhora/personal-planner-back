import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { googleConfig, type GoogleConfig } from '../../config/app.config';
import { MetaDto } from './meta.dto';

@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(@Inject(googleConfig.KEY) private readonly google: GoogleConfig) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Which optional features this server has switched on' })
  @ApiOkResponse({ type: MetaDto })
  get(): MetaDto {
    return { googleClientId: this.google.isEnabled ? this.google.clientId : null };
  }
}
