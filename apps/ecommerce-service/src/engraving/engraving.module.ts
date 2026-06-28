import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PrismaModule } from '@app/prisma';
import { EngravingController } from './engraving.controller';
import { EngravingService } from './engraving.service';

@Module({
  imports: [
    PrismaModule,
    ClientsModule.register([
      {
        name: 'BIOMETRIC_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'biometric',
          protoPath: join(process.cwd(), 'proto/biometric.proto'),
          url: process.env.BIOMETRIC_GRPC_URL ?? 'localhost:50053',
        },
      },
    ]),
  ],
  controllers: [EngravingController],
  providers: [EngravingService],
})
export class EngravingModule {}
