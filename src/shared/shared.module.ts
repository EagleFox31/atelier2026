
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';

@Global()
@Module({
  controllers: [AuditController],
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class SharedModule { }
