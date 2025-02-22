
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

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
    const { applicationId, videoPath } = await req.json();

    if (!applicationId || !videoPath) {
      throw new Error('Missing required parameters: applicationId or videoPath');
    }

    console.log(`Processing video for application ${applicationId} at path ${videoPath}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download the video from storage
    const { data: videoData, error: downloadError } = await supabaseClient
      .storage
      .from('applications')
      .download(videoPath);

    if (downloadError) {
      console.error('Error downloading video:', downloadError);
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }

    // Create form data for OpenAI
    const formData = new FormData();
    formData.append('file', videoData, 'video.webm');
    formData.append('model', 'whisper-1');

    console.log('Sending video to OpenAI for transcription...');

    // Get transcript from OpenAI
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const { text: transcript } = await response.json();

    console.log('Video transcribed successfully, analyzing content...');

    // Analyze the transcript with GPT
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Analyze the candidate\'s video introduction transcript and extract key information about their motivation, experience, and communication style. Return a JSON object with the following structure: {"motivation": string, "experience_summary": string, "communication_score": number, "key_strengths": string[]}'
          },
          {
            role: 'user',
            content: transcript
          }
        ]
      })
    });

    if (!analysisResponse.ok) {
      const error = await analysisResponse.text();
      console.error('GPT analysis error:', error);
      throw new Error(`GPT analysis error: ${error}`);
    }

    const analysis = await analysisResponse.json();

    console.log('Analysis completed successfully');

    // Return the analysis results
    return new Response(
      JSON.stringify({
        transcript,
        analysis: analysis.choices[0].message.content
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: `Error processing video: ${error.message}`
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});
