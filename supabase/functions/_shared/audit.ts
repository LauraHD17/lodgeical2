// _shared/audit.ts
// Fire-and-forget admin action logging. Failures are logged but never block the caller.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function logAdminAction(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('admin_activity').insert({
      property_id: propertyId,
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
      details: details ?? {},
    })
  } catch (e) {
    console.error('[audit] Failed to log:', e)
  }
}
