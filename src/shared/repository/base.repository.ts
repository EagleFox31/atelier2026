
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    lastPage: number;
    currentPage: number;
    perPage: number;
    prev: number | null;
    next: number | null;
  };
}

@Injectable()
export abstract class BaseRepository<T> {
  constructor(protected readonly prisma: PrismaService) {}

  protected async paginate(
    model: any,
    args: any = {},
    options: { page?: number; perPage?: number } = {},
  ): Promise<PaginatedResult<T>> {
    const page = Number(options.page) || 1;
    const perPage = Number(options.perPage) || 10;
    const skip = page > 0 ? perPage * (page - 1) : 0;

    const [total, data] = await Promise.all([
      model.count({ where: args.where }),
      model.findMany({
        ...args,
        take: perPage,
        skip,
      }),
    ]);

    const lastPage = Math.ceil(total / perPage);

    return {
      data,
      meta: {
        total,
        lastPage,
        currentPage: page,
        perPage,
        prev: page > 1 ? page - 1 : null,
        next: page < lastPage ? page + 1 : null,
      },
    };
  }
}
