import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    good_candidate_attributes: '',
    bad_candidate_attributes: '',
    essential_attributes: [] as string[],
    llm_suggested_attributes: [] as string[],
    status: 'draft' as 'draft' | 'published' | 'archived',
    recruiter_id: '' // This will be set when submitting
  });

  useEffect(() => {
    if (id) {
      fetchJob();
    }
    getCurrentUser();
  }, [id]);

  async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setFormData(prev => ({ ...prev, recruiter_id: session.user.id }));
    }
  }

  async function fetchJob() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching job",
        description: error.message,
        variant: "destructive"
      });
    }
  }

  async function analyzeCandidateAttributes() {
    try {
      setAnalyzing(true);
      const response = await fetch('/functions/v1/analyze-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          goodAttributes: formData.good_candidate_attributes,
          badAttributes: formData.bad_candidate_attributes,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setFormData(prev => ({
        ...prev,
        llm_suggested_attributes: data.suggestedAttributes,
        essential_attributes: [...prev.essential_attributes, ...data.suggestedAttributes]
      }));

      toast({
        title: "Analysis Complete",
        description: "Suggested attributes have been added to essential attributes.",
      });
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No authenticated user found");

      const jobData = {
        ...formData,
        recruiter_id: session.user.id
      };

      const { error } = id
        ? await supabase
            .from('jobs')
            .update(jobData)
            .eq('id', id)
        : await supabase
            .from('jobs')
            .insert(jobData);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Job ${id ? 'updated' : 'created'} successfully`,
      });
      navigate('/jobs');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{id ? 'Edit Job' : 'Create New Job'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Job Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="h-32"
                required
              />
            </div>

            <div>
              <Label htmlFor="good_attributes">Good Candidate Attributes</Label>
              <Textarea
                id="good_attributes"
                value={formData.good_candidate_attributes || ''}
                onChange={e => setFormData(prev => ({ ...prev, good_candidate_attributes: e.target.value }))}
                placeholder="Describe what makes a good candidate..."
                className="h-24"
              />
            </div>

            <div>
              <Label htmlFor="bad_attributes">Bad Candidate Attributes</Label>
              <Textarea
                id="bad_attributes"
                value={formData.bad_candidate_attributes || ''}
                onChange={e => setFormData(prev => ({ ...prev, bad_candidate_attributes: e.target.value }))}
                placeholder="Describe what makes a poor candidate fit..."
                className="h-24"
              />
            </div>

            <div>
              <Label>Status</Label>
              <RadioGroup
                value={formData.status}
                onValueChange={value => setFormData(prev => ({ ...prev, status: value as 'draft' | 'published' | 'archived' }))}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="draft" id="draft" />
                  <Label htmlFor="draft">Draft</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="published" id="published" />
                  <Label htmlFor="published">Published</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="archived" id="archived" />
                  <Label htmlFor="archived">Archived</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={analyzeCandidateAttributes}
                disabled={analyzing || !formData.title || !formData.description}
              >
                {analyzing ? 'Analyzing...' : 'Analyze with AI'}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (id ? 'Update Job' : 'Create Job')}
              </Button>
            </div>

            {formData.llm_suggested_attributes.length > 0 && (
              <div>
                <Label>AI Suggested Attributes</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.llm_suggested_attributes.map((attr, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary"
                    >
                      {attr}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
