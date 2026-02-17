import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  SalaryConfig,
  SalaryConfigDocument,
  SalaryConfigStatus,
} from './schemas/salary-config.schema';

@Injectable()
export class SalaryConfigService {
  constructor(
    @InjectModel(SalaryConfig.name) private salaryConfigModel: Model<SalaryConfigDocument>,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  CRUD
  // ══════════════════════════════════════════════════════════════════

  async create(dto: any): Promise<SalaryConfigDocument> {
    // Check duplicate
    const existing = await this.salaryConfigModel.findOne({
      userId: new Types.ObjectId(dto.userId),
    });
    if (existing) {
      throw new BadRequestException('Cấu hình lương đã tồn tại cho nhân viên này');
    }

    return this.salaryConfigModel.create({
      ...dto,
      userId: new Types.ObjectId(dto.userId),
    });
  }

  async findAll(query?: { status?: string; page?: number; limit?: number }) {
    const filter: FilterQuery<SalaryConfig> = {};
    if (query?.status) filter.status = query.status;

    const page = Number(query?.page) || 1;
    const limit = Math.min(Number(query?.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.salaryConfigModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email role')
        .lean(),
      this.salaryConfigModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByUserId(userId: string): Promise<SalaryConfigDocument | null> {
    return this.salaryConfigModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'fullName email role')
      .lean() as any;
  }

  async update(userId: string, dto: any): Promise<SalaryConfigDocument> {
    const config = await this.salaryConfigModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!config) throw new NotFoundException('Cấu hình lương không tồn tại');

    Object.assign(config, dto);
    return config.save();
  }

  async remove(userId: string): Promise<void> {
    const result = await this.salaryConfigModel.deleteOne({
      userId: new Types.ObjectId(userId),
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Cấu hình lương không tồn tại');
    }
  }
}
