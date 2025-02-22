
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from 'lucide-react';

type Profile = {
  id: string;
  role: 'recruiter' | 'candidate';
  full_name: string | null;
  avatar_url: string | null;
};

export function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          setProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    }

    getProfile();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!profile) {
    return <div className="flex justify-center items-center min-h-screen">Profile not found</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome{profile.full_name ? `, ${profile.full_name}` : ''}!</h1>
          <p className="text-muted-foreground mt-2">Here's what's happening with your account.</p>
        </div>
        
        {profile.role === 'recruiter' ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Job Descriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Manage your job listings and review candidate requirements.
                </p>
                <Button
                  onClick={() => navigate('/create-job')}
                  className="w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Job
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Applications Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Review and manage candidate applications and assessments.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/applications')}
                  className="w-full sm:w-auto"
                >
                  View Applications
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Find Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Explore job opportunities that match your skills.
                </p>
                <Button
                  onClick={() => navigate('/jobs')}
                  className="w-full sm:w-auto"
                >
                  Browse Jobs
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>My Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Track your job applications and their status.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/applications')}
                  className="w-full sm:w-auto"
                >
                  View Applications
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
