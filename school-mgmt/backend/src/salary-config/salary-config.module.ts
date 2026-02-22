import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalaryConfigService } from './salary-config.service';
import { SalaryConfigController } from './salary-config.controller';
import { SalaryConfig, SalaryConfigSchema } from './schemas/salary-config.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SalaryConfig.name, schema: SalaryConfigSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SalaryConfigController],
  providers: [SalaryConfigService],
  exports: [SalaryConfigService],
})
export class SalaryConfigModule {}
