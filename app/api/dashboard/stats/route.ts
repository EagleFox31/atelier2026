// Cette route est désormais gérée par NestJS : GET /api/reports/dashboard-stats
// Le proxy Next.js (next.config.ts) achemine /api/reports/* → NestJS:3001
// Ce fichier est conservé pour éviter une 404 sur l'ancienne URL.
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Endpoint déplacé vers /api/reports/dashboard-stats' },
    { status: 301 },
  );
}
