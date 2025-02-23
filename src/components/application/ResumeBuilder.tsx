
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ResumeBuilderProps {
  onResumeGenerated: (markdown: string) => void;
}

export function ResumeBuilder({ onResumeGenerated }: ResumeBuilderProps) {
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');
  const [skills, setSkills] = useState('');
  const [generatedResume, setGeneratedResume] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateResume = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-resume', {
        body: {
          experience,
          education,
          skills,
          currentResume: generatedResume // Send current version for iterative improvements
        }
      });

      if (error) throw error;

      setGeneratedResume(data.markdown);
      onResumeGenerated(data.markdown);

      toast({
        title: "Resume generated",
        description: "Your resume has been generated. Feel free to regenerate or submit.",
      });
    } catch (error) {
      console.error('Error generating resume:', error);
      toast({
        title: "Error generating resume",
        description: "Failed to generate resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Professional Experience</label>
          <Textarea
            placeholder="Describe your work experience, achievements, and responsibilities..."
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="h-32"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Education</label>
          <Textarea
            placeholder="List your education, certifications, and relevant training..."
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            className="h-24"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Skills & Technologies</label>
          <Textarea
            placeholder="List your technical skills, tools, and technologies..."
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            className="h-24"
          />
        </div>
        <Button
          onClick={generateResume}
          disabled={isGenerating || !experience.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Resume'
          )}
        </Button>
      </div>
      <Card className="p-4">
        <div className="prose prose-sm max-w-none">
          {generatedResume ? (
            <div className="whitespace-pre-wrap font-mono text-sm">
              {generatedResume}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-8">
              Your generated resume will appear here
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
