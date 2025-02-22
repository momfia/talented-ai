
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicationId } = await req.json();
    console.log('Getting interview agent URL for application:', applicationId);

    if (!Deno.env.get('ELEVENLABS_API_KEY')) {
      console.error('ELEVENLABS_API_KEY is not configured');
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Get the signed URL from ElevenLabs with the agent ID
    const response = await fetch(
      "https://api.elevenlabs.io/v1/conversation/get_signed_url?agent_id=G52f0rQiQ6VkynMm9PBX",
      {
        method: "GET",
        headers: {
          "xi-api-key": Deno.env.get('ELEVENLABS_API_KEY') ?? '',
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('ElevenLabs API error:', response.status, response.statusText, errorData);
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Successfully got signed URL:', data);

    if (!data.signed_url) {
      console.error('No signed_url in response:', data);
      throw new Error('Invalid response from ElevenLabs API');
    }

    return new Response(
      JSON.stringify({ url: data.signed_url }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error getting interview agent URL:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get interview agent URL',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      }
    );
  }
});
