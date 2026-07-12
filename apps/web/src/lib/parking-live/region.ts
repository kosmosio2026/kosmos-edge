export type RegionParts = {
  region: string;
  district: string;
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstNonEmpty(values: unknown[]) {
  for (const value of values) {
    const text = str(value);
    if (text) return text;
  }

  return '';
}

function splitAddress(address: string) {
  const parts = address
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return {
    region: parts[0] ?? '',
    district: parts[1] ?? '',
  };
}

export function getRegionParts(value: unknown): RegionParts {
  const raw = asRecord(value);

  const address = firstNonEmpty([
    raw.address,
    raw.roadAddress,
    raw.jibunAddress,
    raw.fullAddress,
    raw.addr,
  ]);

  const fromAddress = splitAddress(address);

  const region =
    firstNonEmpty([
      raw.region,
      raw.regionName,
      raw.province,
      raw.state,
      raw.sido,
      raw.region1DepthName,
      raw.region1,
      fromAddress.region,
    ]) || 'All Regions';

  const district =
    firstNonEmpty([
      raw.district,
      raw.city,
      raw.county,
      raw.sigungu,
      raw.region2DepthName,
      raw.region2,
      raw.areaName,
      raw.area,
      fromAddress.district,
    ]) || 'All Districts';

  return {
    region,
    district,
  };
}

export function getRegion(value: unknown) {
  return getRegionParts(value).region;
}

export function getDistrict(value: unknown) {
  return getRegionParts(value).district;
}
