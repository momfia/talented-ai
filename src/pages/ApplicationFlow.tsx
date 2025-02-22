
import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, Video, PhoneCall, User, RefreshCcw } from "lucide-react";
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
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const conversation = useConversation();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
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
      setUserId(session.user.id);
    };

    checkAuth();
  }, [navigate]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId || !jobId) return;

    try {
      setIsUploading(true);
      
      // Create application record
      const { data: application, error: applicationError } = await supabase
        .from('applications')
        .insert({
          job_id: jobId,
          candidate_id: userId,
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

      // Update application
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'resume_uploaded',
          key_attributes: {
            resume_path: filePath
          }
        })
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: true
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }

      // Specify the MIME type for WebM with audio codec
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordedBlob(null);
      setShowPreview(false);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunksRef.current, { 
          type: 'video/webm' 
        });
        setRecordedBlob(videoBlob);
        setShowPreview(true);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = URL.createObjectURL(videoBlob);
          videoRef.current.muted = false;
        }
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Stop recording after 1 minute
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          stopRecording();
        }
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

  const uploadVideo = async () => {
    if (!applicationId || !recordedBlob) return;

    try {
      setIsProcessing(true);

      // Upload video with a unique name to prevent conflicts
      const timestamp = new Date().getTime();
      const filePath = `${applicationId}/video/introduction_${timestamp}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('applications')
        .upload(filePath, recordedBlob, {
          upsert: true // Allow overwriting if file exists
        });

      if (uploadError) throw uploadError;

      // Process video with AI
      const { data: aiAnalysis, error: aiError } = await supabase.functions
        .invoke('analyze-video', {
          body: { applicationId, videoPath: filePath }
        });

      if (aiError) throw aiError;

      // Update application
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'video_uploaded',
          key_attributes: {
            ...aiAnalysis,
            video_path: filePath
          }
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

  const resetRecording = () => {
    setRecordedBlob(null);
    setShowPreview(false);
    if (videoRef.current) {
      videoRef.current.src = '';
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

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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

      {/* Main Content */}
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
                      playsInline
                      controls={showPreview}
                      className="w-full aspect-video bg-black rounded-lg"
                    />
                    <div className="flex justify-center gap-4">
                      {!showPreview ? (
                        <Button
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={isProcessing}
                        >
                          {isRecording ? (
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
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={resetRecording}
                            disabled={isProcessing}
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Record Again
                          </Button>
                          <Button
                            onClick={uploadVideo}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Submit Recording
                              </>
                            )}
                          </Button>
                        </>
                      )}
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
    </div>
  );
}
