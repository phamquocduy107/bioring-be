import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqContext, RmqOptions, Transport } from '@nestjs/microservices';

@Injectable()
export class RmqService {
  constructor(private readonly configService: ConfigService) {}

  private getRabbitMqUri(): string {
    const user = this.configService.get<string>('RABBITMQ_USER');
    const pass = this.configService.get<string>('RABBITMQ_PASS');
    const host = this.configService.get<string>('RABBITMQ_HOST');
    const port = this.configService.get<string>('RABBITMQ_PORT');
    const vhost = this.configService.get<string>('RABBITMQ_VHOST');

    if (!user || !pass || !host || !port || !vhost) {
      throw new Error('Missing RabbitMQ configuration in .env file');
    }

    return `amqp://${user}:${pass}@${host}:${port}/${encodeURIComponent(
      vhost,
    )}`;
  }

  getOptions(queue: string, noAck = false): RmqOptions {
    const exchange =
      this.configService.get<string>('RABBITMQ_EXCHANGE') || 'orchidpal';

    return {
      transport: Transport.RMQ,
      options: {
        urls: [this.getRabbitMqUri()],
        queue: `${queue}_QUEUE`,
        noAck,
        persistent: true,
        queueOptions: {
          durable: true,
        },
        // @ts-ignore
        exchange: exchange,
      },
    };
  }

  ack(context: RmqContext): void {
    const channel = context.getChannelRef();
    const message = context.getMessage();
    channel.ack(message);
  }
}
