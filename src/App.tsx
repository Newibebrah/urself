import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MarketingLayout } from './components/layout/marketing-layout';
import { WorkspaceProvider } from './features/projects/workspace-store';
import { LoginPage } from './pages/auth/login-page';
import { RegisterPage } from './pages/auth/register-page';
import { BillingPage } from './pages/dashboard/billing-page';
import { NewProjectPage } from './pages/dashboard/new-project-page';
import { ProjectBuilderPage } from './pages/dashboard/project-builder-page';
import { ProjectsPage } from './pages/dashboard/projects-page';
import { SettingsPage } from './pages/dashboard/settings-page';
import { BlogDetailPage } from './pages/marketing/blog-detail-page';
import { BlogListPage } from './pages/marketing/blog-list-page';
import { FaqPage } from './pages/marketing/faq-page';
import { HowItWorksPage } from './pages/marketing/how-it-works-page';
import { LandingPage } from './pages/marketing/landing-page';
import { PricingPage } from './pages/marketing/pricing-page';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <ScrollToTop />
        {/* Subtle paper-grain SVG noise texture */}
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-[0.02]"
        >
          <filter id="urself-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#urself-noise)" />
        </svg>

        <Routes>
          {/* Marketing routes */}
          <Route
            path="/"
            element={
              <MarketingLayout>
                <LandingPage />
              </MarketingLayout>
            }
          />
          <Route
            path="/how-it-works"
            element={
              <MarketingLayout>
                <HowItWorksPage />
              </MarketingLayout>
            }
          />
          <Route
            path="/pricing"
            element={
              <MarketingLayout>
                <PricingPage />
              </MarketingLayout>
            }
          />
          <Route
            path="/faq"
            element={
              <MarketingLayout>
                <FaqPage />
              </MarketingLayout>
            }
          />
          <Route
            path="/blog"
            element={
              <MarketingLayout>
                <BlogListPage />
              </MarketingLayout>
            }
          />
          <Route
            path="/blog/:slug"
            element={
              <MarketingLayout>
                <BlogDetailPage />
              </MarketingLayout>
            }
          />

          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Dashboard routes */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:id" element={<ProjectBuilderPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster position="bottom-right" richColors />
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
