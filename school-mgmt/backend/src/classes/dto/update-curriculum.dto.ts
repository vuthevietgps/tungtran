import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurriculumItemDto } from './create-class.dto';

export class UpdateCurriculumDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurriculumItemDto)
  curriculum!: CurriculumItemDto[];
}
