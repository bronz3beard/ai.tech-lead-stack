import { syncTracesFromLangfuse } from '@/lib/analytics-service';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('[AdminSync] Triggering full historical sync...');
    const result = await syncTracesFromLangfuse(); // No limit = Full Sync
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
