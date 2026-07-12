export const backendActionCandidates = {
  entry: [
    '/parking/entry/manual',
    '/sessions/entry/manual',
    '/sessions/manual-entry',
  ],
  exit: [
    '/parking/exit/manual',
    '/sessions/exit/manual',
    '/sessions/manual-exit',
  ],
  collect: [
    '/payments/collect/manual',
    '/payments/manual-collect',
    '/billing/collect/manual',
  ],
  fault: [
    '/devices/faults/report',
    '/devices/fault/report',
    '/devices/faults',
  ],
} as const;

export type BackendQuickAction = keyof typeof backendActionCandidates;