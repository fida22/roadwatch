
import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export function fail(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: e.message, code: e.code, ...e.extra },
      { status: e.status }
    );
  }

  console.error(e);
  return NextResponse.json(
    { error: 'Something went wrong', code: 'SERVER_ERROR' },
    { status: 500 }
  );
}
