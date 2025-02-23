
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const { resumePath, applicationId } = await req.json();
    console.log('Received request:', { resumePath, applicationId });

    if (!resumePath || !applicationId) {
      throw new Error('Resume path and application ID are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    console.log('Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the resume file
    console.log('Downloading resume from storage...');
    const { data: fileData, error: fileError } = await supabase.storage
      .from('applications')
      .download(resumePath);

    if (fileError) {
      console.error('Error downloading file:', fileError);
      throw new Error(`Error downloading resume: ${fileError.message}`);
    }

    if (!fileData) {
      throw new Error('No file data received');
    }

    // Convert file to text
    console.log('Converting file to text...');
    const text = await fileData.text();

    // Check for OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    // Analyze with OpenAI
    console.log('Sending request to OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const aiResponse = await response.json();
    console.log('Received OpenAI response');

    if (!aiResponse.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from OpenAI');
    }

    const analysis = JSON.parse(aiResponse.choices[0].message.content);
    console.log('Parsed analysis:', analysis);

    // Update the application with the analysis
    console.log('Updating application with analysis...');
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        ai_analysis: analysis,
        status: 'resume_analyzed'
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('Error updating application:', updateError);
      throw new Error(`Error updating application: ${updateError.message}`);
    }

    console.log('Analysis completed successfully');
    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-resume function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
