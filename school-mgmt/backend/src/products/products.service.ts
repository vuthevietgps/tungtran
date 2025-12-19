import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private productModel: Model<ProductDocument>) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const name = this.buildName(dto);
    const created = new this.productModel({ ...dto, name });
    return created.save();
  }

  async findAll(): Promise<Product[]> {
    return this.productModel.find().sort({ createdAt: -1 }).lean();
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.productModel.findById(id);
    if (!existing) throw new NotFoundException('Product not found');

    const merged = {
      teacherName: existing.teacherName,
      content: existing.content,
      duration: existing.duration,
      sessionCount: existing.sessionCount,
      productType: existing.productType,
      ...dto,
    };

    const name = this.buildName(merged);
    const updated = await this.productModel
      .findByIdAndUpdate(
        id,
        { ...dto, name },
        { new: true },
      )
      .lean();

    return updated as Product;
  }

  async remove(id: string): Promise<Product> {
    const deleted = await this.productModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Product not found');
    return deleted as Product;
  }

  private buildName(dto: Pick<CreateProductDto, 'teacherName' | 'content' | 'duration' | 'sessionCount'>): string {
    const parts = [dto.teacherName, dto.content, dto.duration, dto.sessionCount]
      .map((p) => p?.toString().trim())
      .filter(Boolean) as string[];
    if (!parts.length) throw new BadRequestException('Thiếu thông tin để tạo tên sản phẩm');
    return parts.join(' - ');
  }
}
