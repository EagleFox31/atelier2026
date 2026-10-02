
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';
import { TransactionalEmailService } from './email/transactional-email.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [PrismaService, AuditService, TransactionalEmailService],
  exports: [PrismaService, AuditService, TransactionalEmailService],
})
export class SharedModule { }
