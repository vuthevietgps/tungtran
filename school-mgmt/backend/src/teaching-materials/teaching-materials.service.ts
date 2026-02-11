import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TeachingMaterial, TeachingMaterialDocument } from './schemas/teaching-material.schema';
import { CreateTeachingMaterialDto, UpdateTeachingMaterialDto } from './dto/teaching-material.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class TeachingMaterialsService {
  constructor(
    @InjectModel(TeachingMaterial.name)
    private readonly materialModel: Model<TeachingMaterialDocument>,
  ) {}

  /**
   * Upload tài liệu giảng dạy
   */
  async create(
    dto: CreateTeachingMaterialDto,
    file: Express.Multer.File,
    actor: JwtPayload,
  ): Promise<TeachingMaterial> {
    // Parse tags nếu gửi dạng JSON string
    let tags: string[] = [];
    if (dto.tags) {
      if (typeof dto.tags === 'string') {
        try {
          tags = JSON.parse(dto.tags as string);
        } catch {
          tags = (dto.tags as string).split(',').map(t => t.trim()).filter(Boolean);
        }
      } else {
        tags = dto.tags;
      }
    }

    const material = new this.materialModel({
      teacherId: new Types.ObjectId(actor.sub),
      title: dto.title,
      description: dto.description,
      subject: dto.subject,
      grade: dto.grade,
      classId: dto.classId ? new Types.ObjectId(dto.classId) : undefined,
      fileUrl: `/uploads/materials/${file.filename}`,
      fileType: file.mimetype,
      fileSize: file.size,
      originalName: file.originalname,
      tags,
      isShared: dto.isShared === true || (dto.isShared as any) === 'true',
    });

    return material.save();
  }

  /**
   * Lấy danh sách tài liệu của GV
   * - TEACHER: chỉ xem tài liệu của mình + tài liệu shared
   * - Staff: xem tất cả
   */
  async findAll(
    actor: JwtPayload,
    filters?: { subject?: string; grade?: string; classId?: string; search?: string },
  ): Promise<TeachingMaterial[]> {
    const query: any = {};

    if (actor.role === Role.TEACHER) {
      // GV xem: của mình HOẶC isShared = true
      query.$or = [
        { teacherId: new Types.ObjectId(actor.sub) },
        { isShared: true },
      ];
    }

    if (filters?.subject) query.subject = filters.subject;
    if (filters?.grade) query.grade = filters.grade;
    if (filters?.classId) query.classId = new Types.ObjectId(filters.classId);
    if (filters?.search) {
      query.$or = [
        ...(query.$or || []),
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { tags: { $in: [new RegExp(filters.search, 'i')] } },
      ];
      // If we had both $or conditions, we need $and
      if (actor.role === Role.TEACHER && filters.search) {
        const ownerOrShared = [
          { teacherId: new Types.ObjectId(actor.sub) },
          { isShared: true },
        ];
        const searchOr = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $in: [new RegExp(filters.search, 'i')] } },
        ];
        delete query.$or;
        query.$and = [
          { $or: ownerOrShared },
          { $or: searchOr },
        ];
      }
    }

    return this.materialModel
      .find(query)
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Lấy 1 tài liệu
   */
  async findOne(id: string, actor: JwtPayload): Promise<TeachingMaterial> {
    const material = await this.materialModel
      .findById(id)
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName')
      .lean();

    if (!material) throw new NotFoundException('Tài liệu không tồn tại');

    // TEACHER chỉ xem của mình hoặc shared
    if (actor.role === Role.TEACHER) {
      const isOwner = (material as any).teacherId?._id?.toString() === actor.sub ||
                      material.teacherId?.toString() === actor.sub;
      if (!isOwner && !material.isShared) {
        throw new NotFoundException('Tài liệu không tồn tại');
      }
    }

    return material;
  }

  /**
   * Cập nhật thông tin tài liệu (chỉ metadata, không đổi file)
   */
  async update(
    id: string,
    dto: UpdateTeachingMaterialDto,
    actor: JwtPayload,
  ): Promise<TeachingMaterial> {
    const material = await this.materialModel.findById(id).lean() as any;
    if (!material) throw new NotFoundException('Tài liệu không tồn tại');

    // TEACHER chỉ sửa của mình
    if (actor.role === Role.TEACHER) {
      if (material.teacherId?.toString() !== actor.sub) {
        throw new ForbiddenException('Bạn không có quyền sửa tài liệu này');
      }
    }

    // Parse tags
    if (dto.tags && typeof dto.tags === 'string') {
      try {
        (dto as any).tags = JSON.parse(dto.tags as unknown as string);
      } catch {
        (dto as any).tags = (dto.tags as unknown as string).split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    if (dto.isShared !== undefined) {
      (dto as any).isShared = dto.isShared === true || (dto.isShared as any) === 'true';
    }

    const updated = await this.materialModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName')
      .lean();

    if (!updated) throw new NotFoundException('Tài liệu không tồn tại');
    return updated;
  }

  /**
   * Xóa tài liệu + file trên disk
   */
  async remove(id: string, actor: JwtPayload): Promise<void> {
    const material = await this.materialModel.findById(id).lean() as any;
    if (!material) throw new NotFoundException('Tài liệu không tồn tại');

    // TEACHER chỉ xóa của mình
    if (actor.role === Role.TEACHER) {
      if (material.teacherId?.toString() !== actor.sub) {
        throw new ForbiddenException('Bạn không có quyền xóa tài liệu này');
      }
    }

    // Xóa file trên disk
    if (material.fileUrl) {
      const filePath = join(process.cwd(), material.fileUrl);
      if (existsSync(filePath)) {
        try { unlinkSync(filePath); } catch { /* ignore */ }
      }
    }

    await this.materialModel.findByIdAndDelete(id);
  }

  /**
   * Tăng download count
   */
  async incrementDownload(id: string): Promise<void> {
    await this.materialModel.findByIdAndUpdate(id, { $inc: { downloadCount: 1 } });
  }

  /**
   * Thống kê tài liệu của GV
   */
  async getStats(teacherId: string) {
    const [total, bySubject, totalSize] = await Promise.all([
      this.materialModel.countDocuments({ teacherId: new Types.ObjectId(teacherId) }),
      this.materialModel.aggregate([
        { $match: { teacherId: new Types.ObjectId(teacherId) } },
        { $group: { _id: '$subject', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.materialModel.aggregate([
        { $match: { teacherId: new Types.ObjectId(teacherId) } },
        { $group: { _id: null, total: { $sum: '$fileSize' } } },
      ]),
    ]);

    return {
      total,
      bySubject: bySubject.reduce((acc, s) => ({ ...acc, [s._id || 'Khác']: s.count }), {}),
      totalSizeBytes: totalSize[0]?.total || 0,
      totalSizeMB: Math.round((totalSize[0]?.total || 0) / 1024 / 1024 * 10) / 10,
    };
  }
}
