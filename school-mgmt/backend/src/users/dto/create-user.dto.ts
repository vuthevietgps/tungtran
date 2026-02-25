import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/interfaces/role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  userCode!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}
