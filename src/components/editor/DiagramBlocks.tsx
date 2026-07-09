import { memo, useEffect, useId, useMemo, useRef, useState } from "react";

interface MermaidDiagramProps {
  code: string;
  isDark: boolean;
}

interface DbmlField {
  name: string;
  type: string;
  meta: string[];
}

interface DbmlTable {
  name: string;
  fields: DbmlField[];
}

interface DbmlRef {
  sourceTable: string;
  sourceField?: string;
  targetTable: string;
  targetField?: string;
}

const normalizeId = (value: string) => value.replace(/^"|"$/g, "").trim();

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
};

const mermaidSvgCache = new Map<string, string>();
const MERMAID_RENDER_VERSION = "v2";

const MermaidDiagramComponent = ({ code, isDark }: MermaidDiagramProps) => {
  const reactId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheKey = `${MERMAID_RENDER_VERSION}:${isDark ? "dark" : "light"}:${code}`;
  const [svg, setSvg] = useState(() => mermaidSvgCache.get(cacheKey) || "");
  const [error, setError] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const cachedSvg = mermaidSvgCache.get(cacheKey);
    if (cachedSvg) {
      setSvg(cachedSvg);
      setError(null);
      return;
    }

    setSvg("");
    if (!shouldRender) return;
    let cancelled = false;

    const render = async () => {
      try {
        setError(null);
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "strict",
          fontFamily: "inherit",
          flowchart: {
            htmlLabels: false,
          },
        });

        const id = `mermaid-${reactId.replace(/:/g, "")}-${hashString(cacheKey)}`;
        const result = await mermaid.render(id, code);
        if (!cancelled) {
          mermaidSvgCache.set(cacheKey, result.svg);
          setSvg(result.svg);
        }
      } catch (err) {
        if (!cancelled) {
          setSvg("");
          setError(err instanceof Error ? err.message : "Failed to render Mermaid diagram");
        }
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [code, isDark, reactId, shouldRender]);

  if (error) {
    return (
      <div ref={containerRef} className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative min-h-36 overflow-auto rounded-md bg-background p-4">
      {svg ? (
        <div
          className="[&_foreignObject]:overflow-visible [&_svg]:mx-auto [&_svg]:max-w-[calc(100%-0.5rem)] [&_svg]:overflow-visible [&_svg_text]:paint-order-stroke [&_svg_text]:[text-rendering:geometricPrecision] [&_svg_*]:animate-none [&_svg_*]:transition-none"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
          {shouldRender ? "Rendering diagram..." : "Diagram will render when visible."}
        </div>
      )}
    </div>
  );
};

export const MermaidDiagram = memo(MermaidDiagramComponent);

const parseDbml = (code: string) => {
  const tables: DbmlTable[] = [];
  const refs: DbmlRef[] = [];
  const tableRe = /Table\s+(?:"([^"]+)"|([A-Za-z0-9_.-]+))(?:\s+as\s+\w+)?\s*\{([\s\S]*?)\}/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRe.exec(code))) {
    const name = normalizeId(tableMatch[1] || tableMatch[2] || "");
    const body = tableMatch[3] || "";
    const fields: DbmlField[] = [];

    body.split(/\r?\n/).forEach((line) => {
      const clean = line.replace(/\/\/.*$/, "").trim();
      if (!clean || /^(indexes|note:|headercolor:|\})/i.test(clean)) return;

      const match = clean.match(/^"([^"]+)"\s+([^\[\s]+)(?:\s+\[([^\]]+)\])?|^([A-Za-z0-9_.-]+)\s+([^\[\s]+)(?:\s+\[([^\]]+)\])?/);
      if (!match) return;

      const fieldName = normalizeId(match[1] || match[4] || "");
      const type = match[2] || match[5] || "";
      const meta = (match[3] || match[6] || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      fields.push({ name: fieldName, type, meta });

      const inlineRef = meta.join(",").match(/ref\s*:\s*([<>-]+)\s*([A-Za-z0-9_."]+)\.([A-Za-z0-9_."]+)/i);
      if (inlineRef) {
        refs.push({
          sourceTable: name,
          sourceField: fieldName,
          targetTable: normalizeId(inlineRef[2]),
          targetField: normalizeId(inlineRef[3]),
        });
      }
    });

    tables.push({ name, fields });
  }

  const refRe = /Ref(?:\s+[A-Za-z0-9_.-]+)?\s*:\s*([A-Za-z0-9_."]+)\.([A-Za-z0-9_."]+)\s*[<>-]+\s*([A-Za-z0-9_."]+)\.([A-Za-z0-9_."]+)/gi;
  let refMatch: RegExpExecArray | null;
  while ((refMatch = refRe.exec(code))) {
    refs.push({
      sourceTable: normalizeId(refMatch[1]),
      sourceField: normalizeId(refMatch[2]),
      targetTable: normalizeId(refMatch[3]),
      targetField: normalizeId(refMatch[4]),
    });
  }

  return { tables, refs };
};

const DbmlDiagramComponent = ({ code }: { code: string }) => {
  const graph = useMemo(() => parseDbml(code), [code]);
  const tableWidth = 260;
  const gapX = 80;
  const gapY = 56;
  const columns = Math.max(1, Math.ceil(Math.sqrt(graph.tables.length || 1)));
  const positions = new Map<string, { x: number; y: number; h: number }>();

  graph.tables.forEach((table, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    positions.set(table.name, {
      x: col * (tableWidth + gapX),
      y: row * (150 + gapY),
      h: 48 + Math.max(1, table.fields.length) * 30,
    });
  });

  const width = Math.max(tableWidth, columns * tableWidth + (columns - 1) * gapX);
  const rows = Math.max(1, Math.ceil(graph.tables.length / columns));
  const height = rows * 210;

  if (!graph.tables.length) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        No DBML tables found.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-md bg-background p-4">
      <div className="relative" style={{ width, height }}>
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <marker id="dbml-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" className="fill-muted-foreground" />
            </marker>
          </defs>
          {graph.refs.map((ref, index) => {
            const source = positions.get(ref.sourceTable);
            const target = positions.get(ref.targetTable);
            if (!source || !target) return null;
            const x1 = source.x + tableWidth;
            const y1 = source.y + source.h / 2;
            const x2 = target.x;
            const y2 = target.y + target.h / 2;
            const mid = x1 + (x2 - x1) / 2;

            return (
              <g key={`${ref.sourceTable}-${ref.targetTable}-${index}`}>
                <path
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                  className="fill-none stroke-muted-foreground/60"
                  strokeWidth="1.5"
                  markerEnd="url(#dbml-arrow)"
                />
              </g>
            );
          })}
        </svg>

        {graph.tables.map((table) => {
          const pos = positions.get(table.name)!;
          return (
            <div
              key={table.name}
              className="absolute overflow-hidden rounded-md border border-border bg-card shadow-sm"
              style={{ left: pos.x, top: pos.y, width: tableWidth }}
            >
              <div className="border-b border-border bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                {table.name}
              </div>
              <div className="divide-y divide-border">
                {(table.fields.length ? table.fields : [{ name: "No fields", type: "", meta: [] }]).map((field) => (
                  <div key={`${table.name}-${field.name}`} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-xs">
                    <span className="truncate font-medium text-foreground">
                      {field.meta.some((item) => /\b(pk|primary key)\b/i.test(item)) && (
                        <span className="mr-1 text-primary">PK</span>
                      )}
                      {field.name}
                    </span>
                    <span className="truncate text-muted-foreground">{field.type}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DbmlDiagram = memo(DbmlDiagramComponent);
