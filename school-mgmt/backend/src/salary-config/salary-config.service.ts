import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  SalaryConfig,
  SalaryConfigDocument,
  SalaryConfigStatus,
} from './schemas/salary-config.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/interfaces/role.enum';

type SalaryConfigUserOption = {
  _id: string;
  fullName: string;
  role: string;
  status: string;
  hasSalaryConfig: boolean;
};

@Injectable()
export class SalaryConfigService {
  constructor(
    @InjectModel(SalaryConfig.name) private salaryConfigModel: Model<SalaryConfigDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  VALIDATION HELPERS
  // ══════════════════════════════════════════════════════════════════

  private validateCommissionTiers(
    tiers: Array<{ minRevenue: number; maxRevenue: number | null; percentage: number }>,
  ): void {
    if (!tiers || tiers.length === 0) return;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (tier.minRevenue < 0) {
        throw new BadRequestException(`Mốc hoa hồng #${i + 1}: minRevenue phải >= 0`);
      }
      if (tier.maxRevenue !== null && tier.maxRevenue !== undefined) {
        if (tier.maxRevenue <= tier.minRevenue) {
          throw new BadRequestException(
            `Mốc hoa hồng #${i + 1}: maxRevenue (${tier.maxRevenue}) phải lớn hơn minRevenue (${tier.minRevenue})`,
          );
        }
      }
      if (tier.percentage < 0 || tier.percentage > 100) {
        throw new BadRequestException(
          `Mốc hoa hồng #${i + 1}: percentage phải trong khoảng 0-100 (hiện tại: ${tier.percentage})`,
        );
      }
    }

    // Check overlapping ranges
    const sorted = [...tiers].sort((a, b) => a.minRevenue - b.minRevenue);
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      const curMax = cur.maxRevenue ?? Infinity;
      if (curMax > next.minRevenue) {
        throw new BadRequestException(
          `Mốc hoa hồng bị chồng lấp: khoảng [${cur.minRevenue}, ${cur.maxRevenue ?? '∞'}] và [${next.minRevenue}, ${next.maxRevenue ?? '∞'}]`,
        );
      }
    }
  }

  private validateKpiTiers(
    tiers: Array<{ minScore: number; maxScore: number; bonusPercentage: number }>,
  ): void {
    if (!tiers || tiers.length === 0) return;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (tier.minScore < 0 || tier.minScore > 100) {
        throw new BadRequestException(
          `Mốc KPI #${i + 1}: minScore phải trong khoảng 0-100`,
        );
      }
      if (tier.maxScore < 0 || tier.maxScore > 100) {
        throw new BadRequestException(
          `Mốc KPI #${i + 1}: maxScore phải trong khoảng 0-100`,
        );
      }
      if (tier.maxScore <= tier.minScore) {
        throw new BadRequestException(
          `Mốc KPI #${i + 1}: maxScore (${tier.maxScore}) phải lớn hơn minScore (${tier.minScore})`,
        );
      }
      if (tier.bonusPercentage < 0) {
        throw new BadRequestException(
          `Mốc KPI #${i + 1}: bonusPercentage phải >= 0`,
        );
      }
    }

    // Check overlapping ranges
    const sorted = [...tiers].sort((a, b) => a.minScore - b.minScore);
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (cur.maxScore > next.minScore) {
        throw new BadRequestException(
          `Mốc KPI bị chồng lấp: khoảng [${cur.minScore}, ${cur.maxScore}] và [${next.minScore}, ${next.maxScore}]`,
        );
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  CRUD
  // ══════════════════════════════════════════════════════════════════

  async create(dto: any): Promise<SalaryConfigDocument> {
    const existing = await this.salaryConfigModel.findOne({
      userId: new Types.ObjectId(dto.userId),
    });
    if (existing) {
      throw new BadRequestException('Cấu hình lương đã tồn tại cho nhân viên này');
    }

    // Validate tiers before saving
    if (dto.commissionTiers) this.validateCommissionTiers(dto.commissionTiers);
    if (dto.kpiBonusTiers) this.validateKpiTiers(dto.kpiBonusTiers);

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

    // Validate tiers before saving
    if (dto.commissionTiers) this.validateCommissionTiers(dto.commissionTiers);
    if (dto.kpiBonusTiers) this.validateKpiTiers(dto.kpiBonusTiers);

    Object.assign(config, dto);
    try {
      return await config.save();
    } catch (err) {
      const isVersionConflict = (err as any)?.name === 'VersionError';
      const isWriteConflict =
        (err as any)?.code === 112 ||
        (err as any)?.codeName === 'WriteConflict' ||
        /WriteConflict/i.test((err as any)?.message || '');

      if (isVersionConflict || isWriteConflict) {
        throw new ConflictException(
          'Cấu hình lương đã thay đổi bởi thao tác khác. Vui lòng tải lại và thử lại.',
        );
      }
      throw err;
    }
  }

  async remove(userId: string): Promise<void> {
    const result = await this.salaryConfigModel.deleteOne({
      userId: new Types.ObjectId(userId),
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Cấu hình lương không tồn tại');
    }
  }

  async listUsersForConfig(): Promise<SalaryConfigUserOption[]> {
    const users = await this.userModel
      .find({ role: { $ne: Role.PARENT } })
      .select('fullName role status')
      .sort({ fullName: 1 })
      .lean();

    const configuredUserIds = await this.salaryConfigModel.distinct('userId');
    const configuredUserIdSet = new Set(configuredUserIds.map((id) => String(id)));

    return users.map((user: any) => ({
      _id: String(user._id),
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      hasSalaryConfig: configuredUserIdSet.has(String(user._id)),
    }));
  }
}
