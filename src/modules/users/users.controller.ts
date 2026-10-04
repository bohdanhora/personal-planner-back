import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'The signed in account and its preferences' })
  @ApiOkResponse({ type: UserDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.usersService.get(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the name, language, timezone or working hours' })
  @ApiOkResponse({ type: UserDto })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.usersService.update(user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the account and everything in it' })
  remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.usersService.remove(user.id);
  }
}
