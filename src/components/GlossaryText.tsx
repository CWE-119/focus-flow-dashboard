import { Fragment, ReactNode, isValidElement, cloneElement, ReactElement } from "react";
import { getGlossaryTerms, useGlossary, GlossaryTerm } from "@/hooks/use-glossary";
import { cn } from "@/lib/utils";

/**
 * Renders text with glossary terms highlighted. Hovering shows the description.
 *
 * Inline override syntax: {{term|meaning just for this spot}}
 * A bare {{term}} forces a highlight even if casing differs.
 */

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const OVERRIDE_RE = /\{\{([^{}|]+?)(?:\|([^{}]*))?\}\}/g;

interface Piece {
  text: string;
  term?: GlossaryTerm;
  override?: string;
}

const buildTermRegex = (terms: GlossaryTerm[]) => {
  if (terms.length === 0) return null;
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);
  return new RegExp(`\\b(${sorted.map((t) => escapeRegex(t.term)).join("|")})\\b`, "gi");
};

const splitPlain = (text: string, terms: GlossaryTerm[]): Piece[] => {
  const regex = buildTermRegex(terms);
  if (!regex) return [{ text }];
  const pieces: Piece[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) pieces.push({ text: text.slice(last, match.index) });
    const found = terms.find((t) => t.term.toLowerCase() === match![1].toLowerCase());
    pieces.push({ text: match[1], term: found });
    last = match.index + match[1].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last) });
  return pieces;
};

const parse = (text: string, terms: GlossaryTerm[]): Piece[] => {
  const pieces: Piece[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  OVERRIDE_RE.lastIndex = 0;
  while ((match = OVERRIDE_RE.exec(text)) !== null) {
    if (match.index > last) pieces.push(...splitPlain(text.slice(last, match.index), terms));
    const label = match[1].trim();
    const found = terms.find((t) => t.term.toLowerCase() === label.toLowerCase());
    pieces.push({
      text: label,
      term: found ?? { id: label, term: label, description: "", createdAt: "" },
      override: match[2]?.trim() || undefined,
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push(...splitPlain(text.slice(last), terms));
  return pieces;
};

const TermChip = ({ piece }: { piece: Piece }) => {
  const description = piece.override || piece.term?.description || "No description yet";
  return (
    <span className="group/term relative inline-block">
      <span
        className={cn(
          "cursor-help border-b border-dashed border-primary/60 bg-primary/10 px-0.5 text-foreground transition-colors group-hover/term:bg-primary/20",
          piece.override && "border-amber-500/70 bg-amber-500/10 group-hover/term:bg-amber-500/20"
        )}
      >
        {piece.text}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-56 whitespace-normal rounded-md border border-border bg-popover p-2 text-left font-body text-[11px] font-normal leading-snug text-popover-foreground shadow-md group-hover/term:block"
      >
        <span className="block font-medium">{piece.term?.term ?? piece.text}</span>
        <span className="mt-0.5 block text-muted-foreground">{description}</span>
        {piece.override && (
          <>
            <span className="mt-1 block text-[10px] uppercase tracking-widest text-amber-600">
              Local override
            </span>
            {piece.term?.description && (
              <span className="mt-0.5 block text-[10px] italic text-muted-foreground/80 line-through">
                {piece.term.description}
              </span>
            )}
          </>
        )}
      </span>
    </span>
  );
};

export const GlossaryText = ({ children }: { children: string }) => {
  const { terms } = useGlossary();
  const pieces = parse(children ?? "", terms);
  return (
    <>
      {pieces.map((piece, i) =>
        piece.term ? <TermChip key={i} piece={piece} /> : <Fragment key={i}>{piece.text}</Fragment>
      )}
    </>
  );
};

/** Walks arbitrary React children and glossary-highlights every string leaf. */
export const glossifyChildren = (children: ReactNode): ReactNode => {
  const terms = getGlossaryTerms();
  const walk = (node: ReactNode, key: number): ReactNode => {
    if (typeof node === "string") {
      if (terms.length === 0 && !node.includes("{{")) return node;
      return <GlossaryText key={key}>{node}</GlossaryText>;
    }
    if (Array.isArray(node)) return node.map((child, i) => walk(child, i));
    if (isValidElement(node)) {
      const element = node as ReactElement<{ children?: ReactNode }>;
      if (element.props?.children == null) return node;
      if (typeof element.type === "string" && ["code", "pre"].includes(element.type)) return node;
      return cloneElement(element, { children: walk(element.props.children, 0) });
    }
    return node;
  };
  return walk(children, 0);
};
