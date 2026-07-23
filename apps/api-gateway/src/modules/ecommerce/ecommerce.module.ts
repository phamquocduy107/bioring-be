import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BIOMETRIC_GRPC_CHANNEL_OPTIONS } from '@app/common';
import { CatalogController } from './catalog/catalog.controller';
import { DesignController } from './design/design.controller';
import { OrderController } from './order/order.controller';
import { EngravingController } from './engraving/engraving.controller';
import { MemoryCardController } from './memory-card/memory-card.controller';
import { CardThemeController } from './card-theme/card-theme.controller';
import { GuestController } from './guest/guest.controller';
import { GuestTabletController } from './guest/guest-tablet.controller';
import { AdminController } from './admin/admin.controller';
import { AdminAuditController } from './admin/admin-audit.controller';
import { CustomerController } from './customer/customer.controller';
import { WarrantyController } from './warranty/warranty.controller';
import { TransactionController } from './transaction/transaction.controller';
import { DeviceController } from './device/device.controller';
import { JewelerController } from './jeweler/jeweler.controller';
import { AddressController } from './address/address.controller';
import {
  RingSizeController,
  MeRingSizeController,
} from './ring-size/ring-size.controller';

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
          channelOptions: BIOMETRIC_GRPC_CHANNEL_OPTIONS,
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
    GuestController,
    GuestTabletController,
    AdminController,
    AdminAuditController,
    CustomerController,
    WarrantyController,
    TransactionController,
    DeviceController,
    JewelerController,
    AddressController,
    RingSizeController,
    MeRingSizeController,
  ],
})
export class EcommerceModule {}
