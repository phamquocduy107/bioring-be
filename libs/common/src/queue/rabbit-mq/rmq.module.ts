import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RmqService } from './rmq.service';
@Module({
  imports: [ConfigModule],
  providers: [RmqService],
  exports: [RmqService],
})
export class RmqModule {
  static register(name: string): DynamicModule {
    return {
      module: RmqModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const user = configService.get<string>('RABBITMQ_USER');
              const pass = configService.get<string>('RABBITMQ_PASS');
              const host = configService.get<string>('RABBITMQ_HOST');
              const port = configService.get<string>('RABBITMQ_PORT');
              const vhost = configService.get<string>('RABBITMQ_VHOST');
              const exchange =
                configService.get<string>('RABBITMQ_EXCHANGE') || 'orchidpal';

              if (!user || !pass || !host || !port || !vhost) {
                throw new Error('Missing RabbitMQ configuration in .env file');
              }

              const uri = `amqp://${user}:${pass}@${host}:${port}/${encodeURIComponent(
                vhost,
              )}`;

              return {
                transport: Transport.RMQ,
                options: {
                  urls: [uri],
                  queue: `${name}_QUEUE`,
                  queueOptions: {
                    durable: true,
                  },
                  // @ts-ignore
                  exchange: exchange,
                  type: 'topic',
                },
              };
            },
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}
