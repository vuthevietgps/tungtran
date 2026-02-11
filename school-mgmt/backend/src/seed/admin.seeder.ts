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
    // Check environment - disable demo accounts in production
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');

    if (nodeEnv === 'production') {
      this.logger.warn('⚠️  Demo account seeding disabled in production environment');
      return;
    }

    this.logger.log('Creating demo accounts for development...');

    // Validate demo password strength
    const demoPassword = this.config.get<string>('DEMO_PASSWORD');
    if (!demoPassword || demoPassword === '123456') {
      this.logger.error('❌ DEMO_PASSWORD not set or using default! Skipping demo accounts.');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(demoPassword, salt);

    const demoUsers: Array<Pick<User, 'email' | 'fullName' | 'role'>> = [
      { email: 'director.demo@school.local', fullName: 'Giám đốc Demo', role: Role.DIRECTOR },
      { email: 'accounting.demo@school.local', fullName: 'Kế toán Demo', role: Role.ACCOUNTING },
      { email: 'ops.demo@school.local', fullName: 'Vận hành Demo', role: Role.OPS },
      { email: 'teacher.demo@school.local', fullName: 'Giáo viên Demo', role: Role.TEACHER },
      { email: 'parent.demo@school.local', fullName: 'Phụ huynh Demo', role: Role.PARENT },
    ];

    for (const demo of demoUsers) {
      const existing = await this.userModel.findOne({ email: demo.email }).exec();
      if (existing) {
        this.logger.log(`Demo account already exists: ${demo.email}`);
        continue;
      }
      await this.userModel.create({ ...demo, password: hashedPassword });
      this.logger.log(`Seeded demo account: ${demo.email} (${demo.role})`);
    }
  }
}
