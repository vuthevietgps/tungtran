import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private productModel: Model<ProductDocument>) {}

  private normalizeCode(code?: string | null): string | null {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();
    return normalized || null;
  }

  private async generateProductCode(): Promise<string> {
    const prefix = 'PKG';
    for (let i = 0; i < 1000; i++) {
      const candidate = `${prefix}${Date.now().toString().slice(-8)}${String(i).padStart(3, '0')}`;
      const exists = await this.productModel.findOne({ code: candidate }).lean();
      if (!exists) return candidate;
    }
    throw new ConflictException('Cannot generate unique product code');
  }

  async create(dto: CreateProductDto): Promise<Product> {
    let code = this.normalizeCode(dto.code);
    if (code) {
      const exists = await this.productModel.findOne({ code }).lean();
      if (exists) throw new ConflictException('Product code already exists');
    } else {
      code = await this.generateProductCode();
    }

    const created = new this.productModel({ ...dto, code });
    return created.save();
  }

  async findAll(): Promise<Product[]> {
    return this.productModel.find().sort({ createdAt: -1 }).lean();
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    if (dto.code) {
      const normalizedCode = this.normalizeCode(dto.code);
      const exists = await this.productModel
        .findOne({ code: normalizedCode, _id: { $ne: id } })
        .lean();
      if (exists) throw new ConflictException('Product code already exists');
      dto.code = normalizedCode as string;
    }
    const updated = await this.productModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!updated) throw new NotFoundException('Product not found');
    return updated as Product;
  }

  async remove(id: string): Promise<Product> {
    const deleted = await this.productModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Product not found');
    return deleted as Product;
  }
}
