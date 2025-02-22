import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { FileUpload } from "@/components/FileUpload";
import { supabase } from "@/integrations/supabase/client";

type Job = {
  id: string;
  title: string;
  description: string;
  essential_attributes: string[];
  status: 'draft' | 'published' | 'archived';
};

export default function PublicJobView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  async function fetchJobDetails() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error: any) {
      toast({
        title: "Error fetching job details",
        description: "This job posting may no longer be available.",
        variant: "destructive"
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = async (fileInfo: { path: string }) => {
    try {
      setApplying(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { error } = await supabase
        .from('applications')
        .insert({
          job_id: id,
          candidate_id: user.id,
          status: 'pending',
          resume_path: fileInfo.path,
          key_attributes: []
        });

      if (error) throw error;

      toast({
        title: "Application submitted!",
        description: "Your application has been received successfully.",
      });
      
      navigate('/applications');
    } catch (error: any) {
      toast({
        title: "Error submitting application",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{job.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Job Description</h3>
              <div className="text-muted-foreground whitespace-pre-wrap">
                {job.description}
              </div>
            </div>

            {job.essential_attributes && job.essential_attributes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Required Qualifications</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {job.essential_attributes.map((attr, index) => (
                    <li key={index}>{attr}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-6 border-t">
              <h3 className="font-semibold mb-4">Apply for this Position</h3>
              <FileUpload
                onUploadComplete={handleFileUpload}
                maxSize={5 * 1024 * 1024}
                acceptedFileTypes={['application/pdf']}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
