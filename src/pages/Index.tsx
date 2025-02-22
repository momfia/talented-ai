
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";

const features = [
  "AI-Powered Candidate Screening",
  "Automated Reference Verification",
  "Voice-Based Interviews",
  "Smart Job Description Management",
  "Real-time Analytics Dashboard",
  "Comprehensive Candidate Insights"
];

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-talent-background">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-talent-border z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/public/lovable-uploads/86e9bbbd-3ac0-4bf9-b238-2b4c7d5e520d.png" alt="Talent Talk Logo" className="h-8 w-8" />
            <span className="text-xl font-semibold text-primary">TalentTalk</span>
          </div>
          <Button onClick={() => navigate("/login")} variant="ghost">
            Sign In
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 gradient-text">
            Transform Your Hiring Process
          </h1>
          <p className="text-lg text-talent-muted mb-8">
            AI-powered candidate screening platform that revolutionizes how you identify and verify top talent.
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate("/register")}
            className="bg-primary hover:bg-primary-600 text-white"
          >
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <Card key={index} className="p-6 glass-card hover:scale-105 transition-transform duration-300">
              <div className="flex items-start space-x-4">
                <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
                <p className="font-medium">{feature}</p>
              </div>
            </Card>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-20 text-center"
        >
          <h2 className="text-3xl font-bold mb-6">Streamline Your Recruitment</h2>
          <div className="aspect-video max-w-4xl mx-auto glass-card p-4">
            <img
              src="/public/lovable-uploads/d6dd1243-3033-402a-aa59-5b01279fcf38.png"
              alt="Dashboard Preview"
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
