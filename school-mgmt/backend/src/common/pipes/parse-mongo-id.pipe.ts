import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined): string | undefined {
    if (value === undefined || value === null || value === '') {
      return value;
    }

    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`"${value}" khong phai ID hop le`);
    }

    return value;
  }
}