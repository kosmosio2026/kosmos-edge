import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class GeoService {
  async searchAddress(query: string) {
    const text = query?.trim();

    if (!text || text.length < 2) {
      return [];
    }

    const key = process.env.KAKAO_REST_API_KEY;

    if (!key) {
      throw new BadRequestException('KAKAO_REST_API_KEY is not configured');
    }

    const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
    url.searchParams.set('query', text);
    url.searchParams.set('size', '10');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${key}`,
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new BadRequestException({
        message: 'Kakao address search failed',
        status: response.status,
        kakaoError: data,
      });
    }

    return (data?.documents ?? []).map((item: any) => ({
      address: item.road_address?.address_name ?? item.address_name,
      roadAddress: item.road_address?.address_name ?? null,
      jibunAddress: item.address?.address_name ?? null,
      zoneNo: item.road_address?.zone_no ?? null,
      lat: Number(item.y),
      lng: Number(item.x),
    }));
  }
}