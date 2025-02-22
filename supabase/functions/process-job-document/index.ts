
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Process with OpenAI
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional job description analyzer. Extract and format the key information from the provided job description document into a clear, well-structured format. Include sections for: Overview, Responsibilities, Requirements, and any additional benefits or important information. Make it concise but comprehensive."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    })

    if (!openAiResponse.ok) {
      const error = await openAiResponse.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const openAiData = await openAiResponse.json()
    const description = openAiData.choices[0].message.content

    // Log the processing result
    console.log('Document processed successfully')

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
