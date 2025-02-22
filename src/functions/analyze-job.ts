
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, goodAttributes, badAttributes } = await req.json();

    const prompt = `
    Analyze this job description:
    Title: ${title}
    Description: ${description}
    Good candidate attributes: ${goodAttributes}
    Bad candidate attributes: ${badAttributes}

    Based on this information, provide an array of 5-10 essential attributes or skills that a candidate should have for this role.
    Format your response as a JSON array of strings, for example: ["attribute1", "attribute2", "attribute3"]
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional job analyst. Respond only with the requested JSON array.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();
    const suggestedAttributes = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify({ suggestedAttributes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
