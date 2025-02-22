
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicationId } = await req.json();

    // Get the signed URL from ElevenLabs
    const response = await fetch(
      "https://api.elevenlabs.io/v1/conversation/get_signed_url",
      {
        method: "GET",
        headers: {
          "xi-api-key": Deno.env.get('ELEVENLABS_API_KEY') ?? '',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get interview agent URL');
    }

    const { signed_url } = await response.json();

    return new Response(
      JSON.stringify({ url: signed_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
