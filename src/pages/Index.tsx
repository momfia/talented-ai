
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { User } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'recruiter' | 'candidate'>('candidate');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            role: selectedRole,
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Login Error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="relative z-10">
        <nav className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl">Talented AI</span>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-32 w-96 h-96 rounded-full bg-primary/5" />
          <div className="absolute top-20 -left-40 w-96 h-96 rounded-full bg-primary/5" />
        </div>

        {/* Content */}
        <div className="container mx-auto px-6 pt-20 pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left column - Copy */}
            <div className="space-y-8">
              <h1 className="text-5xl font-bold leading-tight gradient-text">
                Find Your Perfect Match with AI-Powered Recruitment
              </h1>
              <p className="text-xl text-gray-600">
                Connect talent with opportunity using advanced AI matching technology. 
                Whether you're hiring or seeking your next role, we make the process 
                seamless and intelligent.
              </p>
              
              {/* Login Form */}
              <div className="max-w-md space-y-6 bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-2xl font-semibold">Get Started</h2>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-base">I am a...</Label>
                    <RadioGroup
                      value={selectedRole}
                      onValueChange={(value: 'recruiter' | 'candidate') => setSelectedRole(value)}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="candidate" id="candidate" />
                        <Label htmlFor="candidate">Job Seeker</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="recruiter" id="recruiter" />
                        <Label htmlFor="recruiter">Recruiter</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Button 
                    className="w-full"
                    onClick={handleGoogleLogin}
                  >
                    Continue with Google
                  </Button>
                </div>
              </div>
            </div>

            {/* Right column - Features */}
            <div className="space-y-8 lg:pl-12">
              <div className="grid gap-6">
                <FeatureCard 
                  title="AI-Powered Matching"
                  description="Our advanced AI algorithms ensure the perfect match between candidates and opportunities."
                />
                <FeatureCard 
                  title="Video Interviews"
                  description="Streamline your hiring process with automated video interviews and AI analysis."
                />
                <FeatureCard 
                  title="Smart Assessment"
                  description="Evaluate candidates comprehensively with our intelligent assessment tools."
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
