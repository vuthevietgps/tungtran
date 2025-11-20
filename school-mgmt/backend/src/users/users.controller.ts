import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.DIRECTOR)
  create(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.usersService.createByDirector(dto, req.user);
  }

  @Get()
  @Roles(Role.DIRECTOR)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  me(@Request() req: any) {
    const user = req.user;
    return { id: user._id, email: user.email, fullName: user.fullName, role: user.role };
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req: any) {
    return this.usersService.updateByDirector(id, dto, req.user);
  }

  @Post(':id/lock')
  @Roles(Role.DIRECTOR)
  lock(@Param('id') id: string, @Request() req: any) {
    return this.usersService.lock(id, req.user);
  }

  @Post(':id/unlock')
  @Roles(Role.DIRECTOR)
  unlock(@Param('id') id: string, @Request() req: any) {
    return this.usersService.unlock(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.usersService.removeByDirector(id, req.user);
  }
}
