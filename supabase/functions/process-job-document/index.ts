
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CHUNK_SIZE = 4000;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

async function processChunkWithAI(chunk: string): Promise<any> {
  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional job description analyzer. Structure the job description into these sections:
          1. Overview: A brief 2-3 sentence summary of the role
          2. Key Responsibilities: List of 4-6 main responsibilities
          3. Required Qualifications: List of must-have qualifications
          4. Preferred Qualifications (if any): List of nice-to-have qualifications
          5. Benefits & Perks (if mentioned): List of benefits

          Format each section with clear headings and bullet points where appropriate.
          Be concise and clear. Remove any redundant or unnecessary information.`
        },
        {
          role: "user",
          content: chunk
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    })
  });

  if (!openAiResponse.ok) {
    const error = await openAiResponse.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const openAiData = await openAiResponse.json();
  return openAiData.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { filePath } = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Download the file
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('job-documents')
      .download(filePath)

    if (downloadError) {
      throw downloadError
    }

    // Convert the file to text
    const text = await fileData.text()
    
    // Split text into manageable chunks
    const chunks = chunkText(text);
    console.log(`Processing document in ${chunks.length} chunks`);

    // Process each chunk
    const processedChunks = await Promise.all(
      chunks.map(chunk => processChunkWithAI(chunk))
    );

    // Combine and structure the processed chunks
    const combinedContent = processedChunks.join('\n\n');

    // Process the combined content one final time to ensure consistency
    const finalProcessedContent = await processChunkWithAI(combinedContent);

    // Extract the sections we want from the final processed content
    const description = finalProcessedContent;

    console.log('Document processed successfully');

    return new Response(
      JSON.stringify({ description }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error processing document:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
