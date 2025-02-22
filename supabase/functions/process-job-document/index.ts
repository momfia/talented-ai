
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file uploaded');
    }

    // Sanitize filename and generate path
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(fileExt || '')) {
      throw new Error('Invalid file type. Please upload PDF, DOC, or DOCX files only.');
    }

    const filePath = `${crypto.randomUUID()}.${fileExt}`;

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('job_documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get the file URL
    const { data: { publicUrl } } = supabase.storage
      .from('job_documents')
      .getPublicUrl(filePath);

    // Download the file to extract text
    const fileResponse = await fetch(publicUrl);
    const fileBlob = await fileResponse.blob();
    
    // Process with OpenAI (including file content)
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
            content: 'Extract the job description details from this document. Provide a structured response with: title, description, and key required attributes.'
          },
          {
            role: 'user',
            content: await fileBlob.text()
          }
        ],
      }),
    });

    const aiResponse = await response.json();
    const extractedContent = aiResponse.choices[0].message.content;

    return new Response(
      JSON.stringify({
        success: true,
        filePath,
        extractedContent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
