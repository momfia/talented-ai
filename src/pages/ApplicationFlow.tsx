
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, Video, PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useConversation } from '@11labs/react';

type ApplicationStep = 'resume' | 'video' | 'interview';

export default function ApplicationFlow() {
  const { jobId } = useParams<{ jobId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<ApplicationStep>('resume');
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const conversation = useConversation();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      // Create application record
      const { data: application, error: applicationError } = await supabase
        .from('applications')
        .insert({
          job_id: jobId,
          status: 'in_progress'
        })
        .select()
        .single();

      if (applicationError) throw applicationError;
      
      setApplicationId(application.id);

      // Upload resume
      const filePath = `${application.id}/resume/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('applications')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update application with resume path
      const { error: updateError } = await supabase
        .from('applications')
        .update({ resume_path: filePath })
        .eq('id', application.id);

      if (updateError) throw updateError;

      toast({
        title: "Resume uploaded successfully",
        description: "Let's move on to the video introduction",
      });

      setCurrentStep('video');
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        await uploadVideo(videoBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Stop recording after 1 minute
      setTimeout(() => {
        stopRecording();
      }, 60000);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Error accessing camera",
        description: "Please make sure you have granted camera permissions",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadVideo = async (videoBlob: Blob) => {
    if (!applicationId) return;

    try {
      setIsProcessing(true);

      // Upload video
      const filePath = `${applicationId}/video/introduction.webm`;
      const { error: uploadError } = await supabase.storage
        .from('applications')
        .upload(filePath, videoBlob);

      if (uploadError) throw uploadError;

      // Process video with AI
      const { data: aiAnalysis, error: aiError } = await supabase.functions
        .invoke('analyze-video', {
          body: { applicationId, videoPath: filePath }
        });

      if (aiError) throw aiError;

      // Update application with video path and AI analysis
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          video_path: filePath,
          ai_analysis: aiAnalysis
        })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      toast({
        title: "Video processed successfully",
        description: "Let's proceed to the interview",
      });

      setCurrentStep('interview');
    } catch (error) {
      console.error('Error processing video:', error);
      toast({
        title: "Error processing video",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const startInterview = async () => {
    try {
      setIsProcessing(true);
      
      // Get the signed URL for the agent
      const { data: { url }, error: urlError } = await supabase.functions
        .invoke('get-interview-agent-url', {
          body: { applicationId }
        });

      if (urlError) throw urlError;

      // Start the conversation with the ElevenLabs agent
      await conversation.startSession({ url });

      toast({
        title: "Interview started",
        description: "The AI interviewer will now assess your application",
      });
    } catch (error) {
      console.error('Error starting interview:', error);
      toast({
        title: "Error starting interview",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Job Application Process</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Resume Upload */}
            <div className={`space-y-4 ${currentStep !== 'resume' && 'opacity-50'}`}>
              <h3 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                Upload Your Resume
              </h3>
              {currentStep === 'resume' && (
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
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
              )}
            </div>

            {/* Step 2: Video Introduction */}
            <div className={`space-y-4 ${currentStep !== 'video' && 'opacity-50'}`}>
              <h3 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                Record Video Introduction
              </h3>
              {currentStep === 'video' && (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full aspect-video bg-black rounded-lg"
                  />
                  <div className="flex justify-center">
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isRecording ? (
                        <>
                          <Video className="mr-2 h-4 w-4" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Video className="mr-2 h-4 w-4" />
                          Start Recording (1 min)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: AI Interview */}
            <div className={`space-y-4 ${currentStep !== 'interview' && 'opacity-50'}`}>
              <h3 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                AI Interview
              </h3>
              {currentStep === 'interview' && (
                <div className="flex flex-col items-center gap-4">
                  <Button
                    onClick={startInterview}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <PhoneCall className="mr-2 h-4 w-4" />
                        Start Interview
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    You'll have a 5-minute conversation with our AI interviewer
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
