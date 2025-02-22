import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, Video, PhoneCall, User, RefreshCcw, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useConversation } from '@11labs/react';
import { ELEVEN_LABS_API_KEY } from '@/config/eleven-labs';

type ApplicationStep = 'resume' | 'video' | 'interview';

export default function ApplicationFlow() {
  const { jobId } = useParams<{ jobId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<ApplicationStep>('interview');
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const conversation = useConversation({
    apiKey: ELEVEN_LABS_API_KEY,
    onConnect: () => {
      console.log('Connected to ElevenLabs websocket');
      setIsInterviewActive(true);
      toast({
        title: "Connected to AI Interviewer",
        description: "The interview will begin shortly",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs websocket');
      setIsInterviewActive(false);
      toast({
        title: "Interview Disconnected",
        description: "The connection was lost. Please try again.",
        variant: "destructive",
      });
    },
    onMessage: (message) => {
      console.log('Received message:', message);
      if (message.type === 'error') {
        toast({
          title: "Interview Error",
          description: message.data?.message || "An error occurred",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      if (error.message?.includes('API key')) {
        toast({
          title: "Configuration Error",
          description: "Missing or invalid ElevenLabs API key. Please check your configuration.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Interview Error",
          description: "There was an issue with the interview connection. Please try again.",
          variant: "destructive",
        });
      }
      setIsInterviewActive(false);
    },
  });
  const { isSpeaking, status } = conversation;
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInterviewActive, setIsInterviewActive] = useState(false);

  useEffect(() => {
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
      return session.user.id;
    };

    const loadExistingApplication = async (candidateId: string) => {
      if (!jobId) return;

      try {
        console.log('Loading application for job:', jobId, 'candidate:', candidateId);
        
        const { data: applications, error } = await supabase
          .from('applications')
          .select('*')
          .eq('job_id', jobId)
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          throw error;
        }

        const application = applications?.[0];
        if (application) {
          console.log('Found application:', application);
          setApplicationId(application.id);
          
          if (application.status === 'video_processed' || application.status === 'video_uploaded') {
            console.log('Setting step to interview');
            setCurrentStep('interview');
          } else if (application.status === 'resume_uploaded') {
            console.log('Setting step to video');
            setCurrentStep('video');
          }
          
          if (application.video_path && videoRef.current) {
            setShowPreview(true);
            const { data } = await supabase.storage
              .from('applications')
              .createSignedUrl(application.video_path, 3600);
              
            if (data?.signedUrl) {
              videoRef.current.src = data.signedUrl;
            }
          }
        }
      } catch (error) {
        console.error('Error loading application:', error);
        toast({
          title: "Error",
          description: "Failed to load application data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    const init = async () => {
      const userId = await checkAuth();
      if (userId) {
        await loadExistingApplication(userId);
      }
    };

    init();
  }, [jobId, navigate, toast]);

  useEffect(() => {
    console.log('Conversation status changed:', status);
    console.log('Is speaking:', isSpeaking);
    
    if (status === 'connected') {
      setIsInterviewActive(true);
    } else if (status === 'disconnected') {
      setIsInterviewActive(false);
    }
  }, [status, isSpeaking]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId || !jobId) return;

    try {
      setIsUploading(true);
      
      let currentApplicationId = applicationId;
      
      if (!currentApplicationId) {
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
        
        currentApplicationId = newApplication.id;
        setApplicationId(newApplication.id);
      }

      const timestamp = new Date().getTime();
      const sanitizedFileName = file.name.replace(/[^\x00-\x7F]/g, '');
      const fileExt = sanitizedFileName.split('.').pop();
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

  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=h264,opus',
      'video/webm'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Using MIME type:', type);
        return type;
      }
    }
    console.error('No supported MIME type found');
    return 'video/webm';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }

      const mimeType = getSupportedMimeType();
      console.log('Recording started with MIME type:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        console.log('Data available event, size:', e.data.size);
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, creating blob...');
        const videoBlob = new Blob(chunksRef.current, { 
          type: mimeType
        });
        console.log('Created video blob of size:', videoBlob.size);
        
        setRecordedBlob(videoBlob);
        setShowPreview(true);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = URL.createObjectURL(videoBlob);
          videoRef.current.muted = false;
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

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

      const { data: applications, error: fetchError } = await supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .limit(1);

      if (fetchError || !applications?.[0]) {
        throw new Error('Application not found');
      }

      const timestamp = new Date().getTime();
      const filePath = `${applicationId}/video/introduction_${timestamp}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('applications')
        .upload(filePath, recordedBlob, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'video_uploaded',
          video_path: filePath
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

      let audioStream;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1
          }
        });
        
        audioStream.getAudioTracks().forEach(track => {
          track.enabled = true;
          console.log('Audio track enabled:', track.label, track.readyState);
        });

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass({
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
        const source = audioContext.createMediaStreamSource(audioStream);
        await audioContext.resume();
        console.log('Audio context state:', audioContext.state);

      } catch (error) {
        console.error('Media initialization error:', error);
        throw new Error('Microphone permission denied or audio system error');
      }

      if (!applicationId || !jobId) {
        audioStream?.getTracks().forEach(track => track.stop());
        throw new Error('Missing application or job ID');
      }

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          title,
          description,
          essential_attributes,
          good_candidate_attributes,
          bad_candidate_attributes
        `)
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;

      const { data: applicationData, error: applicationError } = await supabase
        .from('applications')
        .select(`
          resume_path,
          video_path,
          ai_analysis,
          key_attributes
        `)
        .eq('id', applicationId)
        .single();

      if (applicationError) throw applicationError;

      const interviewContext = {
        job: {
          title: jobData.title,
          description: jobData.description,
          essentialAttributes: jobData.essential_attributes || [],
          goodCandidateAttributes: jobData.good_candidate_attributes,
          badCandidateAttributes: jobData.bad_candidate_attributes
        },
        candidate: {
          keyAttributes: applicationData.key_attributes,
          aiAnalysis: applicationData.ai_analysis
        }
      };

      console.log('Starting interview with context:', interviewContext);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      await conversation.startSession({ 
        agentId: "G52f0rQiQ6VkynMm9PBX",
        overrides: {
          agent: {
            language: "en",
            context: JSON.stringify(interviewContext),
            debug: true,
            firstMessage: "Hello! I'm your AI interviewer today. I've reviewed your application and I'd like to ask you some questions about your experience. Are you ready to begin?"
          },
          tts: {
            voiceId: "pNInz6obpgDQGcFmaJgB",
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              similarity_boost: 0.75,
              stability: 0.5,
              style: 0.0,
              use_speaker_boost: true
            }
          },
          stt: {
            sensitivity: 0.5,
            noiseCancellation: true,
            vadConfig: {
              minSpeechActivity: 0.3,
              minSilence: 0.5,
              maxSpeechDuration: 30
            }
          }
        }
      });

      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'interview_started',
        })
        .eq('id', applicationId);

      if (updateError) {
        console.error('Error updating application status:', updateError);
      }

      toast({
        title: "Interview started",
        description: "The AI interviewer will now assess your application",
      });

    } catch (error) {
      console.error('Error starting interview:', error);
      
      if (error instanceof Error && error.message.includes('permission denied')) {
        toast({
          title: "Microphone access required",
          description: "Please allow microphone access to start the interview",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error starting interview",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive",
        });
      }
      setIsInterviewActive(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!userId || isLoading) {
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
              <div className={`space-y-4 ${currentStep !== 'resume' ? 'opacity-50 pointer-events-none' : ''}`}>
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

              <div className={`space-y-4 ${currentStep !== 'video' ? 'opacity-50 pointer-events-none' : ''}`}>
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

              <div className={`space-y-4 ${currentStep !== 'interview' ? 'opacity-50 pointer-events-none' : ''}`}>
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  AI Interview
                </h3>
                {currentStep === 'interview' && (
                  <div className="flex flex-col items-center gap-4">
                    {!isInterviewActive ? (
                      <Button
                        onClick={startInterview}
                        disabled={isProcessing}
                        className="bg-primary text-white px-6 py-2 rounded-full hover:bg-primary/90"
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
                    ) : (
                      <div className="space-y-4 w-full">
                        <div className="flex items-center justify-center gap-4">
                          <div className={`p-4 rounded-full transition-all duration-200 ${isSpeaking ? 'bg-green-100 animate-pulse' : 'bg-gray-100'}`}>
                            {isSpeaking ? (
                              <Mic className="h-6 w-6 text-green-600" />
                            ) : (
                              <MicOff className="h-6 w-6 text-gray-600" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">
                            {isSpeaking ? 'AI Interviewer is speaking...' : 'Listening to your response...'}
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <Button
                            variant="outline"
                            onClick={() => {
                              console.log('Ending interview session...');
                              conversation.endSession();
                            }}
                            className="mt-4"
                          >
                            End Interview
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground text-center">
                      You'll have a conversation with our AI interviewer
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
