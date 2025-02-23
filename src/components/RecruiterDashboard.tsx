
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Users, Star, Video, FileCheck, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import type { ApplicationData } from "@/types/application";
import DashboardLayout from './DashboardLayout';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Application = Database['public']['Tables']['applications']['Row'];
type Job = Database['public']['Tables']['jobs']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface ApplicationWithProfile extends Application {
  profiles: Profile;
}

interface ModalContent {
  type: 'video' | 'transcript' | 'analysis';
  title: string;
  content: any;
}

export default function RecruiterDashboard() {
  const [applications, setApplications] = useState<ApplicationWithProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);
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

  function getStatusBadgeColor(status: string) {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'interviewed':
        return 'bg-blue-100 text-blue-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  const content = loading ? (
    <div className="flex justify-center items-center min-h-screen">
      <p className="text-lg">Loading dashboard...</p>
    </div>
  ) : (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Recruiter Dashboard</h1>
      
      {jobs.map(job => {
        const jobApplications = applications.filter(app => app.job_id === job.id);
        
        return (
          <div key={job.id} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-6 w-6" />
              <h2 className="text-2xl font-semibold">{job.title}</h2>
              <Badge variant="secondary">
                {jobApplications.length} candidate{jobApplications.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            
            <div className="bg-white rounded-lg shadow">
              {jobApplications.map((application, index) => (
                <div key={application.id}>
                  {index > 0 && <Separator />}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback>
                            {application.profiles?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">
                            {application.profiles?.full_name || 'Anonymous Candidate'}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getStatusBadgeColor(application.status)}>
                              {application.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Applied {new Date(application.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {application.resume_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModalContent({
                              type: 'analysis',
                              title: 'Resume Analysis',
                              content: application.ai_analysis
                            })}
                          >
                            <FileCheck className="h-4 w-4 mr-1" />
                            Resume Analysis
                          </Button>
                        )}
                        {application.video_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModalContent({
                              type: 'video',
                              title: 'Video Introduction',
                              content: application.video_path
                            })}
                          >
                            <Video className="h-4 w-4 mr-1" />
                            View Video
                          </Button>
                        )}
                        {application.interview_transcript && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModalContent({
                              type: 'transcript',
                              title: 'Interview Transcript',
                              content: application.interview_transcript
                            })}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Interview Notes
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-yellow-500" />
                          <span className="font-medium">{getAIScore(application.ai_analysis)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog open={!!modalContent} onOpenChange={() => setModalContent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalContent?.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {modalContent?.type === 'video' && (
              <video controls className="w-full rounded-lg">
                <source src={modalContent.content} type="video/webm" />
                Your browser does not support the video tag.
              </video>
            )}
            {modalContent?.type === 'transcript' && (
              <div className="whitespace-pre-wrap font-mono text-sm">
                {modalContent.content}
              </div>
            )}
            {modalContent?.type === 'analysis' && (
              <div className="prose max-w-none">
                <pre className="bg-gray-50 p-4 rounded-lg overflow-auto">
                  {JSON.stringify(modalContent.content, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return <DashboardLayout>{content}</DashboardLayout>;
}
