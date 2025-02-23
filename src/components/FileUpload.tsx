
import { useState } from 'react';
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadProps {
  onProcessed: (data: {
    title: string;
    description: string;
    attributes: string[];
  }) => void;
}

export function FileUpload({ onProcessed }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      // First, upload the file to Supabase storage
      const timestamp = new Date().getTime();
      const sanitizedFileName = file.name.replace(/[^\x00-\x7F]/g, '');
      const filePath = `job-documents/${timestamp}_${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('job-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Then process it using the edge function
      const { data, error } = await supabase.functions.invoke('process-job-document', {
        body: { filePath }
      });

      if (error) throw error;

      if (!data?.extractedContent) {
        throw new Error('No content extracted from document');
      }

      // Parse the AI response and update the form
      const extractedContent = typeof data.extractedContent === 'string' 
        ? JSON.parse(data.extractedContent) 
        : data.extractedContent;

      // Process the document through AI analysis
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-job', {
        body: {
          title: extractedContent.title,
          description: extractedContent.description,
        }
      });

      if (analysisError) throw analysisError;

      onProcessed({
        title: extractedContent.title,
        description: extractedContent.description,
        attributes: analysisData?.suggestedAttributes || [],
      });

      toast({
        title: "Success",
        description: "Job description processed and analyzed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        type="file"
        accept=".pdf,.doc,.docx,.html,.htm"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <Button
        type="button"
        variant="outline"
        disabled={uploading}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        {uploading ? (
          "Processing..."
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload JD
          </>
        )}
      </Button>
    </div>
  );
}
