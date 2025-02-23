
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import OpenAI from 'https://esm.sh/openai@4.20.1';
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
    const { resumePath, applicationId } = await req.json();
    console.log('Received request:', { resumePath, applicationId });

    if (!resumePath || !applicationId) {
      throw new Error('Resume path and application ID are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey || !openAIApiKey) {
      throw new Error('Missing required environment variables');
    }

    const openai = new OpenAI({ apiKey: openAIApiKey });
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    let text = '';
    try {
      if (resumePath.endsWith('.pdf')) {
        text = `This is a PDF document at path: ${resumePath}. 
                For this demo, we're sending a simplified version to OpenAI.
                In a production environment, we would use a PDF parsing library.`;
      } else {
        text = await fileData.text();
      }
    } catch (error) {
      console.error('Error converting file to text:', error);
      throw new Error('Failed to read resume content');
    }

    console.log('Sending request to OpenAI...');
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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
      ]
    });

    const analysis = JSON.parse(chatCompletion.choices[0].message.content);
    console.log('Parsed analysis:', analysis);

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
      throw new Error('Failed to save analysis results');
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
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
