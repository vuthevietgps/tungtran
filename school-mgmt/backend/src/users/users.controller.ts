import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.DIRECTOR)
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.createByDirector(dto, req.user);
  }

  @Get()
  @Roles(Role.DIRECTOR)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('teachers')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS, Role.ACCOUNTING)
  findTeachers() {
    return this.usersService.findByRole(Role.TEACHER);
  }

  @Get('sales')
  @Roles(Role.DIRECTOR, Role.SALE)
  findSales() {
    return this.usersService.findByRole(Role.SALE);
  }

  @Get('parents')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING)
  findParents() {
    return this.usersService.findByRole(Role.PARENT);
  }

  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return {
      _id: req.user._id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      userCode: req.user.userCode,
    };
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.updateByDirector(id, dto, req.user);
  }

  @Post(':id/lock')
  @Roles(Role.DIRECTOR)
  lock(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.lock(id, req.user);
  }

  @Post(':id/unlock')
  @Roles(Role.DIRECTOR)
  unlock(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.unlock(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.removeByDirector(id, req.user);
  }
}
