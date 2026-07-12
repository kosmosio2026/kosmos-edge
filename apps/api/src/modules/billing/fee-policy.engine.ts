export type FeePolicy = {
  baseMinutes: number;
  baseFee: number;
  unitMinutes: number;
  unitFee: number;
  dailyMax: number;
  monthly?: boolean;
  memberDiscountPercent?: number;
};

function calculateSingleDayFee(minutes: number, policy: FeePolicy) {
  if (minutes <= 0) return 0;

  const baseMinutes = Math.max(0, Number(policy.baseMinutes ?? 0));
  const baseFee = Math.max(0, Number(policy.baseFee ?? 0));
  const unitMinutes = Math.max(1, Number(policy.unitMinutes ?? 1));
  const unitFee = Math.max(0, Number(policy.unitFee ?? 0));
  const dailyMax = Math.max(0, Number(policy.dailyMax ?? 0));

  const amount =
    minutes <= baseMinutes
      ? baseFee
      : baseFee + Math.ceil((minutes - baseMinutes) / unitMinutes) * unitFee;

  return dailyMax > 0 ? Math.min(amount, dailyMax) : amount;
}

export function calculateFee(minutes: number, policy: FeePolicy, options?: any) {
  if (options?.monthly) return 0;

  const totalMinutes = Math.max(0, Math.ceil(Number(minutes ?? 0)));
  const dailyMax = Math.max(0, Number(policy.dailyMax ?? 0));

  let total = 0;

  if (dailyMax > 0) {
    const minutesPerDay = 24 * 60;
    const fullDays = Math.floor(totalMinutes / minutesPerDay);
    const remainingMinutes = totalMinutes % minutesPerDay;

    total =
      fullDays * dailyMax + calculateSingleDayFee(remainingMinutes, policy);
  } else {
    total = calculateSingleDayFee(totalMinutes, policy);
  }

  if (options?.isMember) {
    total = Math.floor(
      total * (1 - (policy.memberDiscountPercent || 0) / 100),
    );
  }

  return Math.max(0, total);
}
