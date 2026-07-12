'use client';

import { usePreferences } from '@/components/providers/preferences-provider';

type Props = {
  role?: 'admin' | 'manager' | 'operator';
};

export default function SettingsPage({ role = 'admin' }: Props) {
  const { preferences, updatePreferences } = usePreferences();

  const darkMode = preferences.theme === 'dark';
  const language = preferences.language;
  const defaultLotId = preferences.defaultLotId;

  return (
    <main className="min-h-screen space-y-6 bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {role === 'admin'
            ? '시스템 및 사용자 기본 설정을 관리합니다.'
            : '운영 화면과 개인 기본 설정을 관리합니다.'}
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          User Preferences
        </h2>

        <div className="mt-6 space-y-5">
          <label className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                Dark Mode
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                야간 운영 화면에 적합한 어두운 테마를 사용합니다.
              </div>
            </div>

            <input
              type="checkbox"
              checked={darkMode}
              onChange={(event) => {
                updatePreferences({
                  theme: event.target.checked ? 'dark' : 'light',
                });
              }}
              className="h-5 w-5"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Default Parking Lot
            </span>
            <input
              value={defaultLotId}
              onChange={(event) => {
                updatePreferences({
                  defaultLotId: event.target.value,
                });
              }}
              placeholder="parkingLotId"
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Language
            </span>
            <select
              value={language}
              onChange={(event) => {
                updatePreferences({
                  language: event.target.value as 'ko' | 'en',
                });
              }}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          설정은 자동 저장됩니다.
        </div>
      </section>
    </main>
  );
}
