import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { MemoryCardController } from './memory-card.controller';
import { MemoryCardService } from './memory-card.service';

@Module({
  imports: [PrismaModule],
  controllers: [MemoryCardController],
  providers: [MemoryCardService],
  exports: [MemoryCardService],
})
export class MemoryCardModule {}
