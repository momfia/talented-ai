
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResumeUpload } from "@/components/application/ResumeUpload";
import { VideoRecorder } from "@/components/application/VideoRecorder";
import { AIInterview } from "@/components/application/AIInterview";
import { ApplicationStep } from "@/types/application";

export default function ApplicationFlow() {
  const { id: jobId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<ApplicationStep>('resume');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const checkAuthAndLoadApplication = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast({
            title: "Authentication required",
            description: "Please sign in to apply for this position",
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        const userId = session.user.id;
        setUserId(userId);

        if (!jobId) {
          toast({
            title: "Error",
            description: "Invalid job ID",
            variant: "destructive",
          });
          navigate('/');
          return;
        }

        const { data: applications, error } = await supabase
          .from('applications')
          .select('*')
          .eq('job_id', jobId)
          .eq('candidate_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        const application = applications?.[0];
        if (application) {
          console.log('Found existing application:', application);
          setApplicationId(application.id);
          
          if (application.status === 'video_processed' || 
              application.status === 'video_uploaded' || 
              application.status === 'interview_started') {
            setCurrentStep('interview');
          } else if (application.status === 'resume_uploaded') {
            setCurrentStep('video');
          }
        }
      } catch (error: any) {
        console.error('Error in initialization:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to initialize application",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    checkAuthAndLoadApplication();
  }, [jobId, navigate, toast]);

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg">
              <User className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl">Talented AI</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Job Application Process</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={`space-y-4 ${currentStep !== 'resume' ? 'opacity-50' : ''}`}>
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  Upload Your Resume
                </h3>
                {currentStep === 'resume' && jobId && userId && (
                  <ResumeUpload
                    jobId={jobId}
                    userId={userId}
                    onUploadComplete={(id) => {
                      setApplicationId(id);
                      setCurrentStep('video');
                    }}
                  />
                )}
              </div>

              <div className={`space-y-4 ${currentStep !== 'video' ? 'opacity-50' : ''}`}>
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  Record Video Introduction
                </h3>
                {currentStep === 'video' && applicationId && (
                  <VideoRecorder
                    applicationId={applicationId}
                    onRecordingComplete={() => setCurrentStep('interview')}
                  />
                )}
              </div>

              <div className={`space-y-4 ${currentStep !== 'interview' ? 'opacity-50' : ''}`}>
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  AI Interview
                </h3>
                {currentStep === 'interview' && applicationId && jobId && (
                  <AIInterview
                    applicationId={applicationId}
                    jobId={jobId}
                    onInterviewStart={() => {
                      toast({
                        title: "Interview started",
                        description: "The AI interviewer will now assess your application",
                      });
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
