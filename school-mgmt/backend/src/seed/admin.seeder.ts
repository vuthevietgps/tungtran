import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/interfaces/role.enum';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminSeeder implements OnModuleInit {
  private readonly logger = new Logger(AdminSeeder.name);
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    const demoPassword = this.config.get<string>('DEMO_PASSWORD', '123456');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(demoPassword, salt);

    const demoUsers: Array<Pick<User, 'email' | 'fullName' | 'role'>> = [
      { email: 'director.demo@school.local', fullName: 'Giám đốc Demo', role: Role.DIRECTOR },
      { email: 'manager.demo@school.local', fullName: 'Quản lý Demo', role: Role.MANAGER },
      { email: 'sale.demo@school.local', fullName: 'Nhân viên Sale Demo', role: Role.SALE },
      { email: 'hcns.demo@school.local', fullName: 'Nhân sự Demo', role: Role.HCNS },
      { email: 'partime.demo@school.local', fullName: 'Nhân viên Partime Demo', role: Role.PARTIME },
      { email: 'teacher.demo@school.local', fullName: 'Giáo viên Demo', role: Role.TEACHER },
    ];

    for (const demo of demoUsers) {
      const existing = await this.userModel.findOne({ email: demo.email }).exec();
      if (existing) {
        existing.password = hashedPassword;
        existing.fullName = demo.fullName;
        existing.role = demo.role;
        await existing.save();
        this.logger.log(`Refreshed demo account: ${demo.email}`);
        continue;
      }
      await this.userModel.create({ ...demo, password: hashedPassword });
      this.logger.log(`Seeded demo account: ${demo.email} (${demo.role})`);
    }
  }
}
