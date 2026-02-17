import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WorkSessionsModule } from '../work-sessions/work-sessions.module';
import { SalaryConfigModule } from '../salary-config/salary-config.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    WorkSessionsModule,
    SalaryConfigModule,
    // ThrottlerModule đã được import global ở AppModule
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES', '7d') },
      }),
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
