import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsInt()
  @Min(3)
  @Max(25)
  age!: number;

  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @IsString()
  @Matches(/^[0-9+\-()\s]{6,20}$/)
  parentPhone!: string;

  @IsString()
  faceImage!: string;
}
