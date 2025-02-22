
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function truncateText(text: string, maxLength = 4000): string {
  if (text.length <= maxLength) return text;
  const lastPeriod = text.lastIndexOf('.', maxLength);
  return text.substring(0, lastPeriod + 1);
}

async function processWithAI(text: string): Promise<any> {
  try {
    const truncatedText = truncateText(text);
    
    const systemPrompt = `You are a job description analyzer. Your task is to extract and format key information from the provided job description. You must return a valid JSON object with the following structure exactly:
{
  "description": "string with formatted sections",
  "essential_attributes": ["array", "of", "strings"],
  "good_candidate_attributes": "string",
  "bad_candidate_attributes": "string"
}

Analyze the text and include:
1. A well-formatted job description with:
   - Brief overview
   - Key responsibilities
   - Requirements
2. 5-8 essential attributes as an array
3. Brief good candidate attributes description
4. Brief bad candidate attributes description

BE CONCISE and ensure your response is VALID JSON.`;

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
            content: systemPrompt
          },
          {
            role: "user",
            content: truncatedText
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      })
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openAiData = await openAiResponse.json();
    
    if (!openAiData.choices?.[0]?.message?.content) {
      console.error('Unexpected OpenAI response structure:', openAiData);
      throw new Error('Invalid response from OpenAI API');
    }

    const content = openAiData.choices[0].message.content;
    
    try {
      // Attempt to parse the response and validate its structure
      const parsedContent = JSON.parse(content);
      
      // Validate the required fields and types
      if (typeof parsedContent.description !== 'string') {
        throw new Error('Missing or invalid description field');
      }
      if (!Array.isArray(parsedContent.essential_attributes)) {
        throw new Error('Missing or invalid essential_attributes field');
      }
      if (typeof parsedContent.good_candidate_attributes !== 'string') {
        throw new Error('Missing or invalid good_candidate_attributes field');
      }
      if (typeof parsedContent.bad_candidate_attributes !== 'string') {
        throw new Error('Missing or invalid bad_candidate_attributes field');
      }

      // Return the validated data
      return {
        description: parsedContent.description,
        essential_attributes: parsedContent.essential_attributes,
        good_candidate_attributes: parsedContent.good_candidate_attributes,
        bad_candidate_attributes: parsedContent.bad_candidate_attributes,
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw AI response:', content);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
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
