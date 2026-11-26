import { Module } from '@nestjs/common';

import { FinanceNoticeCollector } from '@api/notification/v1/collectors/FinanceNoticeCollector';
import { StockNoticeCollector } from '@api/notification/v1/collectors/StockNoticeCollector';
import { NotificationTickJob } from '@api/notification/v1/job/NotificationTickJob';
import { NotificationDeviceController } from '@api/notification/v1/notification-device.controller';
import { NotificationDeviceService } from '@api/notification/v1/notification-device.service';
import { NotificationTickService } from '@api/notification/v1/notification-tick.service';
import { NotificationController } from '@api/notification/v1/notification.controller';
import { NotificationService } from '@api/notification/v1/notification.service';
import { FamilyModule } from '@family/family.module';
import { FinanceModule } from '@finance/finance.module';
import { NotificationModule } from '@notification/notification.module';
import { StockModule } from '@stock/stock.module';

// Spec 124: the single entrance of the notification module. It aggregates family, stock and finance (the collectors and
// the tick), the modules themselves never depend on each other.
@Module({
  controllers: [NotificationController, NotificationDeviceController],
  imports: [FamilyModule, FinanceModule, NotificationModule, StockModule],
  providers: [
    FinanceNoticeCollector,
    NotificationDeviceService,
    NotificationService,
    NotificationTickJob,
    NotificationTickService,
    StockNoticeCollector,
  ],
})
export class NotificationAPIModule {}
