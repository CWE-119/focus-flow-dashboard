import type { ReactNode } from "react";
import { useEffect } from "react";
import { ArrowLeft, Camera, Eye } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

interface ShowcaseShellProps {
  children: ReactNode;
  title: string;
  backPath?: string;
  backLabel?: string;
}

const ShowcaseShell = ({ children, title, backPath = "/showcase", backLabel = "Studio" }: ShowcaseShellProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCaptureMode = searchParams.get("capture") === "1";

  useEffect(() => {
    if (!isCaptureMode) return;

    const restoreControls = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const next = new URLSearchParams(searchParams);
      next.delete("capture");
      setSearchParams(next, { replace: true });
    };

    window.addEventListener("keydown", restoreControls);
    return () => window.removeEventListener("keydown", restoreControls);
  }, [isCaptureMode, searchParams, setSearchParams]);

  const enterCaptureMode = () => {
    const next = new URLSearchParams(searchParams);
    next.set("capture", "1");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="relative h-screen overflow-hidden bg-background pt-8 text-foreground">
      {children}

      {!isCaptureMode && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-background/92 p-1.5 shadow-xl backdrop-blur-md">
          <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <span className="hidden max-w-44 truncate px-2 text-xs text-muted-foreground sm:block">
            {title}
          </span>
          <Button variant="outline" size="sm" onClick={enterCaptureMode} className="gap-2">
            <Camera className="h-4 w-4" />
            Clean capture
          </Button>
          <ThemeToggle />
        </div>
      )}

      {isCaptureMode && (
        <button
          type="button"
          aria-label="Restore studio controls"
          title="Restore controls (Esc)"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.delete("capture");
            setSearchParams(next, { replace: true });
          }}
          className="fixed bottom-0 right-0 z-50 h-8 w-8 opacity-0 focus:opacity-100"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default ShowcaseShell;
