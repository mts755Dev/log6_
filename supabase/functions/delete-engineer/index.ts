import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get request body
    const { userId } = await req.json();

    // Validate required fields
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Engineer ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the engineer to be deleted belongs to the same company as the requester
    const { data: targetProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id, role')
      .eq('id', userId)
      .single();

    if (profileError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Engineer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the target user is actually an engineer
    if (targetProfile.role !== 'engineer') {
      return new Response(
        JSON.stringify({ error: 'Can only delete engineer accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get requester's company
    const { data: requesterProfile } = await supabaseClient
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    // Check if requester has permission
    // Allow if: admin OR same company installer (compliance officers are independent, can't delete engineers)
    const canDelete = 
      requesterProfile?.role === 'admin' || 
      (requesterProfile?.company_id === targetProfile.company_id && requesterProfile?.role === 'installer');

    if (!canDelete) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to delete this engineer' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the engineer from Supabase Auth
    // This will cascade delete the profile due to ON DELETE CASCADE
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw new Error(deleteError.message || 'Failed to delete engineer');
    }

    console.log('Successfully deleted engineer:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Engineer deleted successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    
    let errorMessage = 'Failed to delete engineer';
    if (error.message) {
      errorMessage = error.message;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.details || null,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
