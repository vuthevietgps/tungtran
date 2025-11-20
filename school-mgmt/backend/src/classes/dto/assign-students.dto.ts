import { ArrayNotEmpty, ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class AssignStudentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsMongoId({ each: true })
  studentIds!: string[];
}
