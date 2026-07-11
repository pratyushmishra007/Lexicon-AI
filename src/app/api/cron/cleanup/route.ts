import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// This endpoint requires a CRON_SECRET to execute, preventing unauthorized access
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  // In development, or if no secret is set, we bypass the check for easy testing
  if (
    process.env.CRON_SECRET && 
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Delete documents older than 24 hours
    // Since document_chunks has ON DELETE CASCADE, the vectors will be automatically deleted too!
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('documents')
      .delete()
      .lt('created_at', twentyFourHoursAgo)
      .select('id');
      
    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${data.length} old document(s).`,
      deleted_count: data.length
    });
  } catch (error: any) {
    console.error('Cron Cleanup Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clean up old documents' },
      { status: 500 }
    );
  }
}
