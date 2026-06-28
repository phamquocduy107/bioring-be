import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { CardThemeController } from './card-theme.controller';
import { CardThemeService } from './card-theme.service';

@Module({
  imports: [PrismaModule],
  controllers: [CardThemeController],
  providers: [CardThemeService],
})
export class CardThemeModule {}
