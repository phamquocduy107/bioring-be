import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CatalogController } from './catalog/catalog.controller';
import { DesignController } from './design/design.controller';
import { OrderController } from './order/order.controller';
import { EngravingController } from './engraving/engraving.controller';
import { MemoryCardController } from './memory-card/memory-card.controller';
import { CardThemeController } from './card-theme/card-theme.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ECOMMERCE_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'ecommerce',
          protoPath: join(process.cwd(), 'proto/ecommerce.proto'),
          url: process.env.ECOMMERCE_GRPC_URL ?? 'localhost:50051',
        },
      },
    ]),
  ],
  controllers: [
    CatalogController,
    DesignController,
    OrderController,
    EngravingController,
    MemoryCardController,
    CardThemeController,
  ],
})
export class EcommerceModule {}
