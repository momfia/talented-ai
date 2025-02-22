
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  role: 'recruiter' | 'candidate';
  full_name: string | null;
  avatar_url: string | null;
};

export function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Welcome{profile.full_name ? `, ${profile.full_name}` : ''}!</h1>
      
      {profile.role === 'recruiter' ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Post a Job</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Create a new job listing to find the perfect candidate.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>View Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Review and manage candidate applications.</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Find Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Explore job opportunities that match your skills.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>My Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Track your job applications and their status.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
