
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ResumeUploadProps {
  jobId: string;
  userId: string;
  onUploadComplete: (applicationId: string) => void;
}

export function ResumeUpload({ jobId, userId, onUploadComplete }: ResumeUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId || !jobId) return;

    try {
      setIsUploading(true);
      
      const { data: newApplication, error: createError } = await supabase
        .from('applications')
        .insert({
          job_id: jobId,
          candidate_id: userId,
          status: 'in_progress'
        })
        .select()
        .single();

      if (createError) throw createError;
      if (!newApplication) throw new Error('Failed to create application');
      
      const currentApplicationId = newApplication.id;

      const timestamp = new Date().getTime();
      const sanitizedFileName = file.name.replace(/[^\x00-\x7F]/g, '');
      const filePath = `${currentApplicationId}/resume/${timestamp}_${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('applications')
        .upload(filePath, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'resume_uploaded',
          resume_path: filePath
        })
        .eq('id', currentApplicationId);

      if (updateError) throw updateError;

      const { error: analysisError } = await supabase.functions
        .invoke('analyze-resume', {
          body: { resumePath: filePath, applicationId: currentApplicationId }
        });

      if (analysisError) {
        console.error('Error analyzing resume:', analysisError);
        toast({
          title: "Resume uploaded",
          description: "Resume was uploaded but analysis failed. You can still continue.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Resume processed successfully",
          description: "Let's move on to the video introduction",
        });
      }

      onUploadComplete(currentApplicationId);
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast({
        title: "Error uploading resume",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6">
      <input
        type="file"
        accept=".pdf,.doc,.docx,.html,.htm"
        onChange={handleFileUpload}
        className="hidden"
        id="resume-upload"
        disabled={isUploading}
      />
      <Button
        variant="outline"
        onClick={() => document.getElementById('resume-upload')?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload Resume
          </>
        )}
      </Button>
      <p className="text-sm text-muted-foreground mt-2">
        Accepted formats: PDF, DOC, DOCX
      </p>
    </div>
  );
}
