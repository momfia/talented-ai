
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { PhoneCall, Loader2, Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConversation } from '@11labs/react';
import { ApplicationData, JobData } from '@/types/application';

interface AIInterviewProps {
  applicationId: string;
  jobId: string;
  onInterviewStart: () => void;
}

export function AIInterview({ applicationId, jobId, onInterviewStart }: AIInterviewProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const { toast } = useToast();
  
  const conversation = useConversation({
    apiKey: import.meta.env.VITE_ELEVEN_LABS_API_KEY,
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

  const { isSpeaking } = conversation;

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

      } catch (error) {
        console.error('Media initialization error:', error);
        throw new Error('Microphone permission denied or audio system error');
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

      const candidateInfo = applicationData.key_attributes || {};
      const greeting = candidateInfo.full_name ? 
        `Hello ${candidateInfo.full_name}! I'm your AI interviewer today.${
          candidateInfo.pronunciation_note ? 
          ` Before we begin, I want to make sure I'm pronouncing your name correctly. ${candidateInfo.pronunciation_note} Please let me know if I should pronounce it differently.` : 
          ''
        } I've reviewed your application and I'd like to ask you some questions about your experience. Are you ready to begin?` :
        "Hello! I'm your AI interviewer today. I've reviewed your application and I'd like to ask you some questions about your experience. Are you ready to begin?";

      const interviewContext = {
        job: jobData as JobData,
        candidate: {
          personalInfo: candidateInfo,
          keyAttributes: applicationData.key_attributes,
          aiAnalysis: applicationData.ai_analysis,
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
            firstMessage: greeting
          },
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

      onInterviewStart();

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

  return (
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
  );
}
