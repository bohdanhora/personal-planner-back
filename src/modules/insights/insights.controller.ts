import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { InsightsDto, InsightsQueryDto } from './insights.dto';
import { InsightsService } from './insights.service';

@ApiTags('insights')
@ApiBearerAuth()
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  @ApiOperation({ summary: 'Completion trends, streaks and project breakdown' })
  @ApiOkResponse({ type: InsightsDto })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InsightsQueryDto,
  ): Promise<InsightsDto> {
    return this.insightsService.summary(user.id, query.days);
  }
}
