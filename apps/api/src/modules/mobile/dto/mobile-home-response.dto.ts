export class MobileHomeResponseDto {
  currentSession!: unknown;
  vehicles!: unknown[];
  notificationSummary!: {
    unreadCount: number;
    latest: unknown[];
  };
  generatedAt!: string;
}