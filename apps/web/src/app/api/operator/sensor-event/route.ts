import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3000/api';

const DEV_EDGE_API_KEY = process.env.DEV_EDGE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!DEV_EDGE_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          message: 'DEV_EDGE_API_KEY is not configured',
        },
        {
          status: 500,
        },
      );
    }

    const body = await request.json();

    if (!body?.devEui) {
      return NextResponse.json(
        {
          ok: false,
          message: 'devEui is required',
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.parkingStatus !== 'OCCUPIED' &&
      body.parkingStatus !== 'EMPTY'
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: 'parkingStatus must be OCCUPIED or EMPTY',
        },
        {
          status: 400,
        },
      );
    }

    const response = await fetch(`${API_BASE_URL}/sensor/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-edge-api-key': DEV_EDGE_API_KEY,
      },
      body: JSON.stringify({
        devEui: body.devEui,
        parkingStatus: body.parkingStatus,
        raw: {
          source: 'web-operator-dev-route',
        },
      }),
      cache: 'no-store',
    });

    const text = await response.text();

    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Sensor event failed',
          status: response.status,
          payload,
        },
        {
          status: response.status,
        },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unexpected sensor event error',
      },
      {
        status: 500,
      },
    );
  }
}
