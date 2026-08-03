import { Component, Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import MobileLayout from './components/MobileLayout';
import MainTabsContainer from './components/MainTabsContainer';
import { readLanguagePreference, resolveLanguagePreference } from './lib/languagePreference';
import { shouldShowOnboarding } from './lib/onboarding';
import { tForLocale } from './lib/i18n';

const lazyWithRetry = <T extends { default: ComponentType<any> }>(importer: () => Promise<T>) => lazy(async () => {
  try {
    return await importer();
  } catch (firstError) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    try {
      return await importer();
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      return importer().catch((finalError) => {
        console.error('Route import failed after retries:', finalError);
        throw firstError;
      });
    }
  }
});

const importConsumerHome = () => import('./pages/ConsumerHome');
const ConsumerHome = lazyWithRetry(importConsumerHome);
const importAIHealPage = () => import('./pages/AIHealPage');
const AIHealPage = lazyWithRetry(importAIHealPage);
const importDiscoverPage = () => import('./pages/DiscoverPage');
const DiscoverPage = lazyWithRetry(importDiscoverPage);
const importProfilePage = () => import('./pages/ProfilePage');
const ProfilePage = lazyWithRetry(importProfilePage);
const importStudioPage = () => import('./pages/StudioPage');
const StudioPage = lazyWithRetry(importStudioPage);
const importPlayerPage = () => import('./pages/PlayerPage');
const PlayerPage = lazyWithRetry(importPlayerPage);

const preloadMainTabs = () => {
  // Preload core tabs in background after a short delay so it doesn't block initial render
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      importConsumerHome().catch(() => {});
      importDiscoverPage().catch(() => {});
      importStudioPage().catch(() => {});
      importProfilePage().catch(() => {});
      importPlayerPage().catch(() => {});
      importAIHealPage().catch(() => {});
    }, 1200);
  }
};

const AIPromptPage = lazyWithRetry(() => import('./pages/AIPromptPage'));
const AnalyticsPage = lazyWithRetry(() => import('./pages/AnalyticsPage'));
const ScenePicker = lazyWithRetry(() => import('./pages/ScenePicker'));
const TemplatePicker = lazyWithRetry(() => import('./pages/TemplatePicker'));
const MixerWorkbench = lazyWithRetry(() => import('./pages/MixerWorkbench'));
const WorkMetadata = lazyWithRetry(() => import('./pages/WorkMetadata'));
const MyWorks = lazyWithRetry(() => import('./pages/MyWorks'));
const WorkAnalytics = lazyWithRetry(() => import('./pages/WorkAnalytics'));
const BillingUpgrade = lazyWithRetry(() => import('./pages/BillingUpgrade'));
const PublicWorkPage = lazyWithRetry(() => import('./pages/PublicWorkPage'));
const SharedWorkPage = lazyWithRetry(() => import('./pages/SharedWorkPage'));
const ListeningQaPage = lazyWithRetry(() => import('./pages/ListeningQaPage'));
const MobilePlaybackQaPage = lazyWithRetry(() => import('./pages/MobilePlaybackQaPage'));
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'));
const SupportPage = lazyWithRetry(() => import('./pages/SupportPage'));
const OnboardingPage = lazyWithRetry(() => import('./pages/OnboardingPage'));
const AudioCreditsPage = lazy(() => import('./pages/AudioCreditsPage'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));

const RouteFallback = () => (
  <div role="status" aria-label="Loading page" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--bg-main)' }}>
    <span className="animate-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--surface-border)', borderTopColor: 'var(--primary)' }} />
  </div>
);

class RouteErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromProps(nextProps: { resetKey: string }, previousState: { failed: boolean; resetKey?: string }) {
    if (previousState.failed && previousState.resetKey !== nextProps.resetKey) {
      return { failed: false, resetKey: nextProps.resetKey };
    }
    if (previousState.resetKey !== nextProps.resetKey) return { resetKey: nextProps.resetKey };
    return null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Route render failed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const locale = resolveLanguagePreference(readLanguagePreference());
    return (
      <div role="alert" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <section className="glass-panel" style={{ width: 'min(100%, 420px)', padding: 22, textAlign: 'center', display: 'grid', gap: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{tForLocale(locale, 'app.pageError.title')}</h1>
          <p className="text-sm text-secondary" style={{ margin: 0 }}>{tForLocale(locale, 'app.pageError.body')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
              {tForLocale(locale, 'app.pageError.retry')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => window.location.assign('/listen')}>
              {tForLocale(locale, 'app.pageError.home')}
            </button>
          </div>
        </section>
      </div>
    );
  }
}

const LegacyShareRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/sounds?share=${encodeURIComponent(id ?? '')}`} replace />;
};

const ConsumerEntry = () => shouldShowOnboarding()
  ? <Navigate to="/onboarding" replace />
  : <ConsumerHome />;

const AppRoutes = () => {
  const location = useLocation();

  return (
      <RouteErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/" element={<MobileLayout />}>
          {/* Default redirect to consumer home */}
          <Route index element={<Navigate to="/listen" replace />} />
          
          <Route element={<MainTabsContainer 
            consumerHome={<ConsumerEntry />}
            discoverPage={<DiscoverPage />}
            studioPage={<StudioPage />}
            profilePage={<ProfilePage />}
          />}>
          {/* Consumer Routes */}
          <Route path="listen" element={null} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="create" element={<AIHealPage />} />
          <Route path="ai-heal" element={<AIHealPage />} />
          <Route path="explore" element={null} />
          <Route path="discover" element={null} />
          <Route path="sounds" element={null} />
          <Route path="studio" element={null} />
          <Route path="profile" element={null} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="audio-credits" element={<AudioCreditsPage />} />
          <Route path="player" element={<PlayerPage />} />
          
          {/* Creator Routes */}
          <Route path="creator/analytics" element={<AnalyticsPage />} />
          <Route path="creator/ai-prompt" element={<AIPromptPage />} />
          <Route path="creator/create/scene" element={<ScenePicker />} />
          <Route path="creator/create/template" element={<TemplatePicker />} />
          <Route path="creator/mix" element={<MixerWorkbench />} />
          <Route path="creator/save" element={<WorkMetadata />} />
          <Route path="creator/works" element={<MyWorks />} />
          <Route path="creator/analytics/:id" element={<WorkAnalytics />} />
          <Route path="creator/share/:id" element={<LegacyShareRedirect />} />
          <Route path="creator/upgrade" element={<BillingUpgrade />} />
          <Route path="internal/listening-qa" element={<ListeningQaPage />} />
          <Route path="internal/mobile-playback-qa" element={<MobilePlaybackQaPage />} />
          
          {/* Listener Routes */}
          <Route path="work/:id" element={<PublicWorkPage />} />
          <Route path="s/:slug" element={<SharedWorkPage />} />
          <Route path="*" element={<Navigate to="/listen" replace />} />
          </Route>
          </Route>
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
  );
};

function App() {
  useEffect(() => {
    preloadMainTabs();
  }, []);

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
