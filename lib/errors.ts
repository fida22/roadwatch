import { NextResponse } from 'next/server';

export class ApiError extends Error {
  public status: number;
  public code: string;
  public extra: Record<string, unknown>;
  public conflicts?: any;

  constructor(status: number, code: string, message: string, extra?: Record<string, unknown>);
  constructor(message: string, code: string, status?: number, conflicts?: any);
  constructor(a: number | string, b: string, c?: string | number, d?: any) {
    if (typeof a === 'number') {
      super((c as string) || '');
      this.status = a;
      this.code = b;
      this.extra = (d as Record<string, unknown>) || {};
    } else {
      super(a);
      this.code = b;
      this.status = typeof c === 'number' ? c : 400;
      this.conflicts = d;
      this.extra = d ? { conflicts: d } : {};
    }
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
