export type AppMode = "cloud" | "edge";

export function getAppMode(): AppMode {
  const mode = process.env.APP_MODE?.toLowerCase();

  if (mode === "cloud" || mode === "edge") {
    return mode;
  }

  return "edge";
}

export function isCloudMode(): boolean {
  return getAppMode() === "cloud";
}

export function isEdgeMode(): boolean {
  return getAppMode() === "edge";
}

export function assertAppMode(expected: AppMode): void {
  const actual = getAppMode();

  if (actual !== expected) {
    throw new Error(`Invalid APP_MODE. Expected ${expected}, got ${actual}`);
  }
}