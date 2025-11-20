import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private productModel: Model<ProductDocument>) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const exists = await this.productModel.findOne({ code: dto.code.toUpperCase() }).lean();
    if (exists) throw new ConflictException('Product code already exists');
    const created = new this.productModel({ ...dto, code: dto.code.toUpperCase() });
    return created.save();
  }

  async findAll(): Promise<Product[]> {
    return this.productModel.find().sort({ createdAt: -1 }).lean();
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    if (dto.code) {
      const exists = await this.productModel
        .findOne({ code: dto.code.toUpperCase(), _id: { $ne: id } })
        .lean();
      if (exists) throw new ConflictException('Product code already exists');
      dto.code = dto.code.toUpperCase();
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
