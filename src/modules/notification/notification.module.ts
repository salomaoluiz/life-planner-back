import { Module } from '@nestjs/common';

import { CheckExpoReceiptsUseCase } from '@notification/application/use-case/CheckExpoReceiptsUseCase';
import { CleanupNotificationsUseCase } from '@notification/application/use-case/CleanupNotificationsUseCase';
import { CreateSummaryNoticeUseCase } from '@notification/application/use-case/CreateSummaryNoticeUseCase';
import { CreateUrgentNoticesUseCase } from '@notification/application/use-case/CreateUrgentNoticesUseCase';
import { DeleteNotificationDeviceUseCase } from '@notification/application/use-case/DeleteNotificationDeviceUseCase';
import { DeleteNotificationsByUserUseCase } from '@notification/application/use-case/DeleteNotificationsByUserUseCase';
import { FindDueNotificationUsersUseCase } from '@notification/application/use-case/FindDueNotificationUsersUseCase';
import { GetNotificationPreferencesUseCase } from '@notification/application/use-case/GetNotificationPreferencesUseCase';
import { GetUnreadStatsUseCase } from '@notification/application/use-case/GetUnreadStatsUseCase';
import { ListNotificationDevicesUseCase } from '@notification/application/use-case/ListNotificationDevicesUseCase';
import { ListNotificationsUseCase } from '@notification/application/use-case/ListNotificationsUseCase';
import { MarkAllNotificationsReadUseCase } from '@notification/application/use-case/MarkAllNotificationsReadUseCase';
import { MarkDeviceSeenUseCase } from '@notification/application/use-case/MarkDeviceSeenUseCase';
import { MarkNotificationReadUseCase } from '@notification/application/use-case/MarkNotificationReadUseCase';
import { RegisterNotificationDeviceUseCase } from '@notification/application/use-case/RegisterNotificationDeviceUseCase';
import { RemoveFamilyNotificationsUseCase } from '@notification/application/use-case/RemoveFamilyNotificationsUseCase';
import { SendPendingDeliveriesUseCase } from '@notification/application/use-case/SendPendingDeliveriesUseCase';
import { SendTestPushUseCase } from '@notification/application/use-case/SendTestPushUseCase';
import { UpdateNotificationDeviceUseCase } from '@notification/application/use-case/UpdateNotificationDeviceUseCase';
import { UpdateNotificationPreferencesUseCase } from '@notification/application/use-case/UpdateNotificationPreferencesUseCase';
import { NotificationDatasource } from '@notification/data/datasource/NotificationDatasource';
import { NotificationDeviceDatasource } from '@notification/data/datasource/NotificationDeviceDatasource';
import { NotificationPreferenceDatasource } from '@notification/data/datasource/NotificationPreferenceDatasource';
import { NotificationDeviceRepository } from '@notification/data/repository/NotificationDeviceRepository';
import { NotificationPreferenceRepository } from '@notification/data/repository/NotificationPreferenceRepository';
import { NotificationRepository } from '@notification/data/repository/NotificationRepository';

// Spec 124: modules export use cases only. The collectors that read stock and finance live in `src/api/notification`.
const useCases = [
  CheckExpoReceiptsUseCase,
  CleanupNotificationsUseCase,
  CreateSummaryNoticeUseCase,
  CreateUrgentNoticesUseCase,
  DeleteNotificationDeviceUseCase,
  DeleteNotificationsByUserUseCase,
  FindDueNotificationUsersUseCase,
  GetNotificationPreferencesUseCase,
  GetUnreadStatsUseCase,
  ListNotificationDevicesUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkDeviceSeenUseCase,
  MarkNotificationReadUseCase,
  RegisterNotificationDeviceUseCase,
  RemoveFamilyNotificationsUseCase,
  SendPendingDeliveriesUseCase,
  SendTestPushUseCase,
  UpdateNotificationDeviceUseCase,
  UpdateNotificationPreferencesUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'INotificationRepository', useClass: NotificationRepository },
    { provide: 'INotificationDatasource', useClass: NotificationDatasource },
    { provide: 'INotificationDeviceRepository', useClass: NotificationDeviceRepository },
    { provide: 'INotificationDeviceDatasource', useClass: NotificationDeviceDatasource },
    { provide: 'INotificationPreferenceRepository', useClass: NotificationPreferenceRepository },
    { provide: 'INotificationPreferenceDatasource', useClass: NotificationPreferenceDatasource },
  ],
})
export class NotificationModule {}
