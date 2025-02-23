
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Users, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import type { ApplicationData } from "@/types/application";

type Application = Database['public']['Tables']['applications']['Row'];
type Job = Database['public']['Tables']['jobs']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface ApplicationWithProfile extends Application {
  profiles: Profile;
}

export default function RecruiterDashboard() {
  const [applications, setApplications] = useState<ApplicationWithProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [jobsResponse, applicationsResponse] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('recruiter_id', user.id),
        supabase
          .from('applications')
          .select(`
            *,
            profiles (*)
          `)
          .eq('status', 'completed')
      ]);

      if (jobsResponse.error) throw jobsResponse.error;
      if (applicationsResponse.error) throw applicationsResponse.error;

      setJobs(jobsResponse.data || []);
      setApplications(applicationsResponse.data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  function getAIScore(aiAnalysis: ApplicationData['ai_analysis']) {
    if (!aiAnalysis || typeof aiAnalysis !== 'object') return 'N/A';
    const score = (aiAnalysis as any).overall_score;
    return score ? `${Math.round(score * 100)}%` : 'N/A';
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-lg">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Recruiter Dashboard</h1>
      
      {jobs.map(job => {
        const jobApplications = applications.filter(app => app.job_id === job.id);
        
        return (
          <div key={job.id} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-6 w-6" />
              <h2 className="text-2xl font-semibold">{job.title}</h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {jobApplications.map(application => (
                <Card key={application.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {application.profiles?.full_name || 'Anonymous Candidate'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-yellow-500" />
                          <span className="text-sm font-medium">AI Score</span>
                        </div>
                        <span className="font-bold">
                          {getAIScore(application.ai_analysis)}
                        </span>
                      </div>
                      
                      {application.interview_transcript && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setSelectedTranscript(application.interview_transcript)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          View Interview Transcript
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog open={!!selectedTranscript} onOpenChange={() => setSelectedTranscript(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Interview Transcript</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap font-mono text-sm">
            {selectedTranscript}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
