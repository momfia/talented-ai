
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function processWithAI(text: string): Promise<any> {
  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: "system",
            content: `Analyze this job description and extract the following information in a structured format:

            1. Create a well-formatted job description with:
               - Overview (2-3 sentences)
               - Key Responsibilities (4-6 bullet points)
               - Technical Requirements
               - Additional Requirements

            2. Extract a list of 5-8 essential attributes that a candidate must have

            3. Create a brief description of what makes a good candidate for this role
               Focus on soft skills, personality traits, and working style

            4. Create a brief description of what would make a bad candidate for this role
               Focus on characteristics that would make someone unsuitable

            Return the results as a JSON object with these keys:
            - description (formatted text with sections)
            - essential_attributes (array of strings)
            - good_candidate_attributes (string)
            - bad_candidate_attributes (string)
            `
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.5,
        max_tokens: 2000
      })
    });

    if (!openAiResponse.ok) {
      const error = await openAiResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const openAiData = await openAiResponse.json();
    const content = openAiData.choices[0].message.content;
    
    try {
      const parsedContent = JSON.parse(content);
      return {
        description: parsedContent.description || "",
        essential_attributes: Array.isArray(parsedContent.essential_attributes) ? parsedContent.essential_attributes : [],
        good_candidate_attributes: parsedContent.good_candidate_attributes || "",
        bad_candidate_attributes: parsedContent.bad_candidate_attributes || "",
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.log('Raw AI response:', content);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  } catch (error) {
    console.error('Error in processWithAI:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('job-documents')
      .download(filePath);

    if (downloadError) {
      throw downloadError;
    }

    const text = await fileData.text();
    
    // Process the text with AI
    const processedData = await processWithAI(text);

    return new Response(
      JSON.stringify(processedData),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing document:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
