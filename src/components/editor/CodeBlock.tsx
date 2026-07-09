import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import mermaid from "react-syntax-highlighter/dist/esm/languages/prism/mermaid";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { memo, useState, useEffect } from "react";
import { DbmlDiagram, MermaidDiagram } from "@/components/editor/DiagramBlocks";

const dbml = (Prism: any) => {
  Prism.languages.dbml = {
    comment: /\/\/.*|\/\*[\s\S]*?\*\//,
    string: {
      pattern: /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/,
      greedy: true,
    },
    keyword: /\b(?:Table|TableGroup|Ref|Enum|Project|Note|Indexes|Index|HeaderColor|database_type|primary key|increment|unique|not null|null|pk|note|ref|default|delete|update)\b/i,
    "class-name": {
      pattern: /(\b(?:Table|TableGroup|Enum|Project)\s+)[\w."-]+/,
      lookbehind: true,
    },
    property: {
      pattern: /(\[\s*)\w+(?=\s*:|\s*\])/,
      lookbehind: true,
    },
    type: /\b(?:int|integer|bigint|float|double|decimal|numeric|boolean|bool|varchar|char|text|date|datetime|timestamp|time|uuid|json|jsonb|blob)\b/i,
    operator: /[<>-]+|\b(?:as)\b/i,
    punctuation: /[{}[\]():,.;]/,
    number: /\b\d+(?:\.\d+)?\b/,
  };
};
dbml.displayName = "dbml";
dbml.aliases = ["database", "schema"];

SyntaxHighlighter.registerLanguage("dbml", dbml);
SyntaxHighlighter.registerLanguage("mermaid", mermaid);

interface CodeBlockProps {
  language?: string;
  children: string;
}

const DBML_ALIASES = new Set(["dbml", "database", "schema"]);
const MERMAID_ALIASES = new Set(["mermaid", "mmd"]);

const normalizeLanguage = (language?: string) => {
  const normalized = language?.toLowerCase();
  if (normalized && DBML_ALIASES.has(normalized)) return "dbml";
  if (normalized && MERMAID_ALIASES.has(normalized)) return "mermaid";
  return normalized;
};

const getIsDarkTheme = () => {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  const bgColor = getComputedStyle(root).getPropertyValue("--background").trim();
  const match = bgColor.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (match) return parseFloat(match[3]) < 50;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export const CodeBlock = memo(({ language, children }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(getIsDarkTheme);
  const normalizedLanguage = normalizeLanguage(language);
  const isMermaid = normalizedLanguage === "mermaid";
  const isDbml = normalizedLanguage === "dbml";

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(getIsDarkTheme());
    };
    
    checkDarkMode();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg my-3">
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-muted/80 border-b border-border text-xs z-10">
        <span className="text-muted-foreground font-mono">
          {normalizedLanguage || "text"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? (
            <Check className="h-3 w-3 text-primary" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      {isMermaid || isDbml ? (
        <div className="pt-9">
          {isMermaid ? (
            <MermaidDiagram code={children} isDark={isDark} />
          ) : (
            <DbmlDiagram code={children} />
          )}
        </div>
      ) : (
        <SyntaxHighlighter
          language={normalizedLanguage || "text"}
          style={isDark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            paddingTop: "2.5rem",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
          }}
          showLineNumbers={children.split("\n").length > 3}
          wrapLines
        >
          {children}
        </SyntaxHighlighter>
      )}
    </div>
  );
});

// Inline code component
export const InlineCode = ({ children }: { children: React.ReactNode }) => {
  return (
    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm text-foreground">
      {children}
    </code>
  );
};
