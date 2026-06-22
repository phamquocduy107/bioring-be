import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'IDENTITY_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'identity',
          protoPath: join(process.cwd(), 'proto/identity.proto'),
          url: process.env.IDENTITY_GRPC_URL ?? 'localhost:50052',
        },
      },
    ]),
  ],
  controllers: [IdentityController],
  providers: [IdentityService],
})
export class IdentityModule {}
