import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PhoneCall, Loader2, Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConversation } from '@11labs/react';
import { ApplicationData, JobData, CandidateInfo } from '@/types/application';

interface AIInterviewProps {
  applicationId: string;
  jobId: string;
  onInterviewStart: () => void;
}

export function AIInterview({ applicationId, jobId, onInterviewStart }: AIInterviewProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const { toast } = useToast();
  const audioStreamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<string[]>([]);

  const getFirstName = (fullName?: string) => {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  };

  const formatInterviewContext = (jobData: JobData, applicationData: ApplicationData) => {
    const candidateInfo = applicationData.key_attributes as CandidateInfo;
    const firstName = getFirstName(candidateInfo?.full_name);
    
    return {
      job: {
        title: jobData.title,
        description: jobData.description,
        requirements: {
          essential: jobData.essential_attributes,
          desirable: jobData.good_candidate_attributes,
          avoid: jobData.bad_candidate_attributes
        }
      },
      candidate: {
        name: firstName,
        fullName: candidateInfo?.full_name,
        pronunciationNote: candidateInfo?.pronunciation_note,
        analysis: applicationData.ai_analysis
      },
      interviewGoals: [
        "Assess candidate's qualifications against job requirements",
        "Evaluate communication skills and cultural fit",
        "Allow candidate to demonstrate their experience"
      ]
    };
  };

  const handleInterviewEnd = async () => {
    console.log('Ending interview session...');
    if (transcriptRef.current.length === 0) {
      console.log('No transcript available, skipping analysis');
      return;
    }

    const fullTranscript = transcriptRef.current.join('\n');
    console.log('Full transcript length:', fullTranscript.length);

    try {
      console.log('Updating application with transcript...');
      const { error: transcriptError } = await supabase
        .from('applications')
        .update({
          conversation_transcript: fullTranscript,
          status: 'interview_completed'
        })
        .eq('id', applicationId);

      if (transcriptError) {
        console.error('Error updating transcript:', transcriptError);
        throw transcriptError;
      }

      console.log('Calling analyze-interview function...');
      const { data: assessmentData, error: assessmentError } = await supabase
        .functions.invoke('analyze-interview', {
          body: JSON.stringify({
            applicationId,
            jobId,
            transcript: fullTranscript
          })
        });

      if (assessmentError) {
        console.error('Error from analyze-interview function:', assessmentError);
        throw assessmentError;
      }

      if (!assessmentData) {
        throw new Error('No assessment data received from function');
      }

      console.log('Assessment data received:', assessmentData);

      console.log('Updating application with assessment results...');
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          assessment_score: assessmentData.score,
          interview_feedback: assessmentData.feedback
        })
        .eq('id', applicationId);

      if (updateError) {
        console.error('Error updating assessment:', updateError);
        throw updateError;
      }

      toast({
        title: "Interview Completed",
        description: "Interview assessment has been generated.",
      });
    } catch (error) {
      console.error('Error processing interview:', error);
      toast({
        title: "Error Processing Interview",
        description: error instanceof Error ? error.message : "There was an issue saving the interview results.",
        variant: "destructive",
      });
    }
  };

  const conversation = useConversation({
    apiKey: import.meta.env.VITE_ELEVEN_LABS_API_KEY,
    onConnect: () => {
      console.log('Connected to ElevenLabs websocket');
      setIsInterviewActive(true);
      transcriptRef.current = [];
      toast({
        title: "Connected to AI Interviewer",
        description: "The interview will begin shortly",
      });
    },
    onDisconnect: async () => {
      console.log('Disconnected from ElevenLabs websocket');
      setIsInterviewActive(false);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Audio track stopped:', track.label);
        });
        audioStreamRef.current = null;
      }

      await handleInterviewEnd();
    },
    onMessage: (message) => {
      console.log('Received message type:', message.type);
      if (message.type === 'transcript') {
        const text = message.data?.text || '';
        console.log('Adding human transcript:', text);
        transcriptRef.current.push(`Human: ${text}`);
      } else if (message.type === 'response') {
        const text = message.data?.text || '';
        console.log('Adding AI response:', text);
        transcriptRef.current.push(`AI: ${text}`);
      } else if (message.type === 'error') {
        console.error('Message error:', message.data);
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
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    },
  });

  const initializeAudio = async () => {
    try {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      audioStreamRef.current = stream;
      
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('Audio track initialized:', track.label, track.readyState);
      });

      return stream;
    } catch (error) {
      console.error('Media initialization error:', error);
      throw new Error('Microphone permission denied or audio system error');
    }
  };

  const startInterview = async () => {
    try {
      setIsProcessing(true);

      try {
        await initializeAudio();
      } catch (error) {
        console.error('Audio initialization error:', error);
        throw new Error('Failed to initialize microphone. Please check your permissions and try again.');
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

      const candidateInfo = applicationData.key_attributes as CandidateInfo;
      const firstName = getFirstName(candidateInfo?.full_name);
      
      const greeting = firstName ? 
        `Hi ${firstName}! I'm your AI interviewer today.${
          candidateInfo?.pronunciation_note ? 
          ` Before we begin, I want to make sure I'm pronouncing your name correctly. ${candidateInfo.pronunciation_note} Please let me know if I should pronounce it differently.` : 
          ''
        } I've reviewed your application and I'd like to ask you some questions about your experience. Are you ready to begin?` :
        "Hello! I'm your AI interviewer today. I've reviewed your application and I'd like to ask you some questions about your experience. Are you ready to begin?";

      const interviewContext = formatInterviewContext(jobData as JobData, applicationData as ApplicationData);
      console.log('Formatted interview context:', JSON.stringify(interviewContext, null, 2));
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      await conversation.startSession({ 
        agentId: "G52f0rQiQ6VkynMm9PBX",
        overrides: {
          agent: {
            language: "en",
            prompt: {
              prompt: `You are Erin, a warm, engaging, and empathetic recruiting agent conducting this job interview. Your role is to connect with candidates on a personal level, treating each conversation like a genuine dialogue rather than an automated script.

Interview Context:
${JSON.stringify(interviewContext, null, 2)}

Guidelines for the conversation:

1. Warm, Personalized Introduction:
- Start with a friendly greeting
- Use the candidate's name sparingly in the opening exchanges to build rapport
- After using their name twice, avoid repeating it to keep the conversation natural

2. Natural, Evolving Dialogue:
- Begin with open-ended questions about their career journey
- Avoid echoing responses; instead, build on them with deeper questions
- Focus on technical skills related to the job requirements
- Transition smoothly from friendly questions to probing inquiries

3. Active Listening & Intelligent Follow-Up:
- Respond with thoughtful reflections that acknowledge their input
- Adapt questions based on their responses
- Request concrete examples related to the job's essential requirements
- Show genuine curiosity about their experience

4. Balanced Exploration of Key Areas:
- Technical Expertise: Focus on projects relevant to ${jobData.title} position
- Interpersonal & Empathy Skills: Explore how they work with others
- Personality & Motivation: Understand their alignment with job requirements

5. Assessment Focus:
- Evaluate technical skills against essential requirements: ${jobData.essential_attributes.join(', ')}
- Look for positive attributes: ${jobData.good_candidate_attributes}
- Be mindful of potential concerns: ${jobData.bad_candidate_attributes}

Remember to:
- Maintain a conversational, relaxed tone that is both professional and empathetic
- Focus questions on matching their experience with job requirements
- Keep responses concise and focused
- Be encouraging and professional throughout
- Listen carefully to pronunciation preferences
- Provide opportunities for the candidate to demonstrate their experience

Your goal is to conduct an intelligent, evolving conversation that feels human and thoughtful—ensuring the candidate is engaged, understood, and appropriately evaluated for the role.`
            },
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
            <div className={`p-4 rounded-full transition-all duration-200 ${conversation.isSpeaking ? 'bg-green-100 animate-pulse' : 'bg-gray-100'}`}>
              {conversation.isSpeaking ? (
                <Mic className="h-6 w-6 text-green-600" />
              ) : (
                <MicOff className="h-6 w-6 text-gray-600" />
              )}
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {conversation.isSpeaking ? 'AI Interviewer is speaking...' : 'Listening to your response...'}
            </div>
          </div>
          
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => {
                console.log('Manually ending interview session...');
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
