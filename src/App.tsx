import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "@/lib/router";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { UpdateNotification } from "./components/UpdateNotification";
import { ErrorBoundary } from "./components/ErrorBoundary";
import TitleBar from "./components/TitleBar";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SessionProvider } from "./contexts/SessionContext";
import { NoteTimerProvider } from "./contexts/NoteTimerContext";

const queryClient = new QueryClient();
const Notes = lazy(() => import("./pages/Notes"));
const Canvas = lazy(() => import("./pages/Canvas"));
const Help = lazy(() => import("./pages/Help"));
const ShowcaseHub = lazy(() => import("./pages/showcase/ShowcaseHub"));
const FocusShowcase = lazy(() => import("./pages/showcase/FocusShowcase"));
const NotesShowcase = lazy(() => import("./pages/showcase/NotesShowcase"));
const GraphShowcase = lazy(() => import("./pages/showcase/GraphShowcase"));

// Use HashRouter for Electron (file:// protocol), BrowserRouter for web
const Router = (window as Window & { electron?: { isElectron?: boolean } }).electron?.isElectron
  ? HashRouter
  : BrowserRouter;

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <NoteTimerProvider>
            <TooltipProvider>
              <TitleBar />
              <Toaster />
              <Sonner />
              <UpdateNotification />
              <Router>
                <Suspense fallback={<div className="min-h-screen bg-background pt-8" />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/canvas" element={<Canvas />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/showcase" element={<ShowcaseHub />} />
                    <Route path="/showcase/focus" element={<FocusShowcase />} />
                    <Route path="/showcase/notes" element={<NotesShowcase />} />
                    <Route path="/showcase/graph" element={<GraphShowcase />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Router>
            </TooltipProvider>
          </NoteTimerProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
