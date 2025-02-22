import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadProps {
  onProcessed: (data: {
    title: string;
    description: string;
    attributes: string[];
  }) => void;
}

export function PublicJobView() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [job, setJob] = useState<{
    title: string;
    description: string;
    attributes: string[];
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  async function fetchJobDetails() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('title, description, essential_attributes')
        .eq('id', id)
        .single();

      if (error) throw error;

      setJob({
        title: data.title,
        description: data.description,
        attributes: data.essential_attributes || [],
      });
    } catch (error: any) {
      toast({
        title: "Error fetching job details",
        description: error.message,
        variant: "destructive"
      });
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      
      // Upload file to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Process the uploaded document
      const { data, error } = await supabase.functions.invoke('process-job-document', {
        body: { filePath: uploadData.path }
      });

      if (error) throw error;

      if (data) {
        onProcessed({
          title: data.title || '',
          description: data.description || '',
          attributes: data.attributes || [],
        });

        toast({
          title: "Success",
          description: "Job description processed successfully",
        });
      }
    } catch (error: any) {
      console.error('Error processing document:', error);
      toast({
        title: "Error",
        description: "Failed to process document",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const onProcessed = (data: {
    title: string;
    description: string;
    attributes: string[];
  }) => {
    setJob({
      title: data.title,
      description: data.description,
      attributes: data.attributes,
    });
  };

  if (!job) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>{job.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={job.description} readOnly className="min-h-[150px]" />
          </div>
          <div className="space-y-2">
            <Label>Essential Attributes</Label>
            <ul>
              {job.attributes.map((attr, index) => (
                <li key={index} className="ml-4 list-disc">{attr}</li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Upload Revised Job Description</Label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.html,.htm"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                type="button"
                variant="outline"
                disabled={isProcessing}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                {isProcessing ? (
                  "Processing..."
                ) : (
                  <>
                    Upload JD
                  </>
                )}
              </Button>
              {isProcessing && <p className="text-sm text-muted-foreground">Processing document...</p>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Accepted formats: PDF, DOC, DOCX, HTML
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
