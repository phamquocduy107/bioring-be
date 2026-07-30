import { Module } from '@nestjs/common';
import { NotificationListener } from './notification.listener';
import { InvoiceBuilder } from './invoice.builder';

@Module({
  providers: [InvoiceBuilder, NotificationListener],
})
export class NotificationModule {}
