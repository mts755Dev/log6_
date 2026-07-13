import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/assistant.ts';

interface FeedbackPayload {
  interactionId?: string;
  feedback?: 'up' | 'down';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = (await req.json().catch(() => ({}))) as FeedbackPayload;
    if (!payload.interactionId || !payload.feedback) {
      return jsonResponse({ error: 'interactionId and feedback are required' }, 400);
    }

    const { data: interaction, error: fetchError } = await supabase
      .from('assistant_interactions')
      .select('id, user_id')
      .eq('id', payload.interactionId)
      .single();

    if (fetchError || !interaction) {
      return jsonResponse({ error: 'Interaction not found' }, 404);
    }

    if (interaction.user_id !== authData.user.id) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const { error: updateError } = await supabase
      .from('assistant_interactions')
      .update({ feedback: payload.feedback })
      .eq('id', payload.interactionId);

    if (updateError) throw updateError;

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('assistant-feedback error:', error);
    return jsonResponse({ error: error?.message || 'Feedback failed' }, 400);
  }
});
