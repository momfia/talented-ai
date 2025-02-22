
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicationId, videoPath } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download the video from storage
    const { data: videoData, error: downloadError } = await supabaseClient
      .storage
      .from('applications')
      .download(videoPath);

    if (downloadError) throw downloadError;

    // Convert video to audio and transcribe it
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: new FormData().append('file', videoData, 'video.webm').append('model', 'whisper-1'),
    });

    if (!response.ok) {
      throw new Error('Failed to transcribe video');
    }

    const { text: transcript } = await response.json();

    // Analyze the transcript with GPT
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Analyze the candidate\'s video introduction transcript and extract key information about their motivation, experience, and communication style. Return a JSON object with relevant insights.'
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!analysisResponse.ok) {
      throw new Error('Failed to analyze transcript');
    }

    const analysis = await analysisResponse.json();

    return new Response(
      JSON.stringify(analysis),
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
