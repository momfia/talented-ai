
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { OpenAI } from "https://esm.sh/openai@4.28.4";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicationId, videoPath } = await req.json();
    console.log('Received request:', { applicationId, videoPath });

    if (!applicationId || !videoPath) {
      throw new Error('Missing required parameters: applicationId or videoPath');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create a FormData object
    const formData = new FormData();

    // Download the video from storage
    const { data: videoData, error: downloadError } = await supabaseClient
      .storage
      .from('applications')
      .download(videoPath);

    if (downloadError) {
      console.error('Error downloading video:', downloadError);
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }

    // Create a blob from the video data
    const blob = new Blob([videoData], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    console.log('Sending to OpenAI for transcription...');

    // Send directly to OpenAI API
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const { text: transcript } = await transcriptionResponse.json();
    console.log('Transcription received:', transcript?.substring(0, 100) + '...');

    // Initialize OpenAI client for chat completion
    const openai = new OpenAI({ 
      apiKey: Deno.env.get('OPENAI_API_KEY')
    });

    console.log('Analyzing transcript...');
    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
    });

    const analysis = analysisResponse.choices[0].message.content;
    console.log('Analysis completed:', analysis?.substring(0, 100) + '...');

    // Update the application with the analysis results
    const { error: updateError } = await supabaseClient
      .from('applications')
      .update({
        video_transcript: transcript,
        video_analysis: analysis,
        status: 'video_analyzed'
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('Error updating application:', updateError);
      throw new Error(`Failed to update application: ${updateError.message}`);
    }

    console.log('Successfully updated application with analysis');

    return new Response(
      JSON.stringify({
        transcript,
        analysis
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
        error: error instanceof Error ? error.message : 'Unknown error occurred'
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
