
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

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not configured');
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Get the signed URL from ElevenLabs
    const response = await fetch(
      "https://api.elevenlabs.io/v2/conversation/start", // Updated to v2 endpoint
      {
        method: "POST", // Changed to POST method
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: "G52f0rQiQ6VkynMm9PBX",
          // Adding optional parameters for better debugging
          debug: true,
          transport_type: "browser"
        })
      }
    );

    if (!response.ok) {
      let errorMessage = `ElevenLabs API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.text();
        console.error('ElevenLabs API error details:', response.status, response.statusText, errorData);
        errorMessage += ` - ${errorData}`;
      } catch (e) {
        console.error('Could not parse error response:', e);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Successfully got response:', data);

    if (!data.connection_url) { // Updated to use connection_url instead of signed_url
      console.error('No connection_url in response:', data);
      throw new Error('Invalid response from ElevenLabs API');
    }

    return new Response(
      JSON.stringify({ url: data.connection_url }), // Updated to use connection_url
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
