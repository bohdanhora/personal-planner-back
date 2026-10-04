import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import {
  ChatReplyDto,
  ChatRequestDto,
  DayContextDto,
  DraftsDto,
  ParseRequestDto,
  PlanDto,
  SuggestRequestDto,
  SuggestionDto,
  TipsDto,
} from './assistant.dto';
import { AssistantService } from './assistant.service';

const ASSISTANT_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('assistant')
@ApiBearerAuth()
@Throttle(ASSISTANT_THROTTLE)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('parse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Turn a free text note into task drafts' })
  @ApiOkResponse({ type: DraftsDto })
  parse(@CurrentUser() user: AuthenticatedUser, @Body() dto: ParseRequestDto): Promise<DraftsDto> {
    return this.assistantService.parse(user.id, dto);
  }

  @Post('suggest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rewrite one task in the house style and fill in its details' })
  @ApiOkResponse({ type: SuggestionDto })
  suggest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SuggestRequestDto,
  ): Promise<SuggestionDto> {
    return this.assistantService.suggest(user.id, dto);
  }

  @Post('plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Propose a schedule for the open tasks of a day' })
  @ApiOkResponse({ type: PlanDto })
  plan(@CurrentUser() user: AuthenticatedUser, @Body() dto: DayContextDto): Promise<PlanDto> {
    return this.assistantService.plan(user.id, dto.date);
  }

  @Post('tips')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Specific advice for a day based on the plan and recent history' })
  @ApiOkResponse({ type: TipsDto })
  tips(@CurrentUser() user: AuthenticatedUser, @Body() dto: DayContextDto): Promise<TipsDto> {
    return this.assistantService.tips(user.id, dto.date);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Talk to the assistant, it can propose tasks' })
  @ApiOkResponse({ type: ChatReplyDto })
  chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChatRequestDto): Promise<ChatReplyDto> {
    return this.assistantService.chat(user.id, dto);
  }
}
