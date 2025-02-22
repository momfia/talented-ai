
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import { JobForm } from "@/components/JobForm";
import JobManagement from "@/pages/JobManagement";
import JobDetails from "@/pages/JobDetails";
import PublicJobView from "@/pages/PublicJobView";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes without sidebar */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/jobs/:id/apply" element={<PublicJobView />} />

        {/* Protected routes with sidebar */}
        <Route
          path="/"
          element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/jobs" element={<JobManagement />} />
                <Route path="/jobs/:id" element={<JobDetails />} />
                <Route path="/create-job" element={<JobForm />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          }
        />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
