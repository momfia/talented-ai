
import { useState } from 'react';
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/process-job-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process document');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Parse the AI response and update the form
      const extractedContent = JSON.parse(data.extractedContent);
      onProcessed({
        title: extractedContent.title,
        description: extractedContent.description,
        attributes: extractedContent.attributes || [],
      });

      toast({
        title: "Success",
        description: "Job description processed successfully",
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
        accept=".pdf,.doc,.docx"
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
