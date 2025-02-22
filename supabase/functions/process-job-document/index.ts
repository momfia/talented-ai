
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CHUNK_SIZE = 4000; // characters per chunk, leaving room for system prompt

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

async function processChunkWithAI(chunk: string): Promise<string> {
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
          content: "Extract key information from this job description chunk. Focus on Overview, Responsibilities, Requirements, and Benefits if present. Be concise."
        },
        {
          role: "user",
          content: chunk
        }
      ],
      temperature: 0.7,
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

    // Combine processed chunks
    const description = processedChunks.join('\n\n');

    // Log the processing result
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
