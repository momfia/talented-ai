
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import { JobForm } from "@/components/JobForm";
import JobManagement from "@/pages/JobManagement";
import JobDetails from "@/pages/JobDetails";
import PublicJobView from "@/pages/PublicJobView";
import ApplicationFlow from "@/pages/ApplicationFlow";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/create-job" element={<JobForm />} />
        <Route path="/jobs" element={<JobManagement />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/jobs/:id/apply" element={<PublicJobView />} />
        <Route path="/apply/:jobId" element={<ApplicationFlow />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
