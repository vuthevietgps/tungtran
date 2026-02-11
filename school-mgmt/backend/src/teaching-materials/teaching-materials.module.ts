import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeachingMaterialsController } from './teaching-materials.controller';
import { TeachingMaterialsService } from './teaching-materials.service';
import { TeachingMaterial, TeachingMaterialSchema } from './schemas/teaching-material.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TeachingMaterial.name, schema: TeachingMaterialSchema },
    ]),
  ],
  controllers: [TeachingMaterialsController],
  providers: [TeachingMaterialsService],
  exports: [TeachingMaterialsService],
})
export class TeachingMaterialsModule {}
