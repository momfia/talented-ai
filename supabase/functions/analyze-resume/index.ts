
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumePath, applicationId } = await req.json();

    if (!resumePath || !applicationId) {
      throw new Error('Resume path and application ID are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get the resume file
    const { data: fileData, error: fileError } = await supabase.storage
      .from('applications')
      .download(resumePath);

    if (fileError) {
      throw new Error(`Error downloading resume: ${fileError.message}`);
    }

    // Convert file to text
    const text = await fileData.text();

    // Analyze with OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are a professional resume analyzer. Extract key information and provide a structured analysis.'
          },
          {
            role: 'user',
            content: `Analyze this resume and provide a JSON response with the following structure:
              {
                "skills": string[],
                "experience_summary": string,
                "key_achievements": string[],
                "education": string[],
                "strengths": string[],
                "potential_areas_of_improvement": string[]
              }
              
              Resume text:
              ${text}`
          }
        ],
      }),
    });

    const aiResponse = await response.json();
    if (!aiResponse.choices?.[0]?.message?.content) {
      throw new Error('Failed to get analysis from AI');
    }

    const analysis = JSON.parse(aiResponse.choices[0].message.content);

    // Update the application with the analysis
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        ai_analysis: analysis,
        status: 'resume_analyzed'
      })
      .eq('id', applicationId);

    if (updateError) {
      throw new Error(`Error updating application: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-resume function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
