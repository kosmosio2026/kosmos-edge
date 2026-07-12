export interface AppPreferences {
  denseMode: boolean;
  showFooter: boolean;
  showSystemStatusOnAdminHome: boolean;
  theme: 'light' | 'dark' | 'system';
  language: 'ko' | 'en';
  defaultLotId: string;
}
