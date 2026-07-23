import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { ParkingModule } from './modules/parking/parking.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';
import { BillingModule } from './modules/billing/billing.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DevicesModule } from './modules/devices/devices.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { MobileAuthModule } from './modules/mobile-auth/mobile-auth.module';
import { EnforcementModule } from './modules/enforcement/enforcement.module';
import { OperatorModule } from './modules/operator/operator.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { OutstandingModule } from './modules/outstanding/outstanding.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { DisplayModule } from './modules/display/display.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { SystemModule } from './modules/system/system.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { GeoModule } from './modules/geo/geo.module';
import { ParkingSessionsModule } from './modules/parking-sessions/parking-sessions.module';
import { EdgeModule } from './modules/edge/edge.module';
import { SyncModule } from './modules/sync/sync.module';
import { SensorIngestModule } from './modules/sensor-ingest/sensor-ingest.module';
import { ParkingMonitorModule } from './modules/parking-monitor/parking-monitor.module';
import { ParkingRegistrationModule } from './modules/parking-registration/parking-registration.module';
import { FeesModule } from './modules/fees/fees.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ControlPanelModule } from './modules/control-panel/control-panel.module';
import { PublicParkingModule } from './modules/public-parking/public-parking.module';
import { WatcherModule } from './modules/watcher/watcher.module';
import { ManagerWatcherModule } from './modules/manager-watcher/manager-watcher.module';
import { PlateRecognitionModule } from './modules/plate-recognition/plate-recognition.module';
import { FilesModule } from './modules/files/files.module';
import { RegistrationReviewModule } from './modules/registration-review/registration-review.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ManagementCompaniesModule } from './modules/management-companies/management-companies.module';

import { EdgeNodesModule } from './modules/edge-nodes/edge-nodes.module';
import { TenantAppModule } from './modules/tenant-app/tenant-app.module';
@Module({
  imports: [
    TenantAppModule,
    EdgeNodesModule,
    ControlPanelModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],

    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    RbacModule,
    UsersModule,
    BillingModule,
    RealtimeModule,
    SessionsModule,
    PaymentsModule,
    DevicesModule,
    AnalyticsModule,
    MobileModule,
    MobileAuthModule,
    EnforcementModule,
    OperatorModule,
    SubscriptionsModule,
    OutstandingModule,
    SettlementModule,
    DisplayModule,
    ParkingModule,
    ApprovalModule,
    SystemModule,
    SessionsModule,
    FacilitiesModule,
    GeoModule,
    ParkingSessionsModule,
    EdgeModule,
    SyncModule,
    SensorIngestModule,
    ParkingMonitorModule,
    ParkingRegistrationModule,
    FeesModule,
    InvoicesModule,
    PlateRecognitionModule,
    FilesModule,
    RegistrationReviewModule,
    ManagerWatcherModule,
    WatcherModule,
    PublicParkingModule,
        TenantsModule,
        ManagementCompaniesModule,
],
})
export class AppModule {}
