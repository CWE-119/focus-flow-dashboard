import { useState, useCallback, useRef, useEffect } from 'react';
import { getApiBaseUrl } from '@/lib/api';

export type AnnotationTool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'rect' | 'circle' | 'text' | 'pan';

export interface AnnotationCanvas {
  width: number;
  height: number;
}

export interface AnnotationBase {
  id: string;
  visible?: boolean;
  locked?: boolean;
  layer?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StrokeAnnotation extends AnnotationBase {
  type: 'stroke';
  tool: 'pen' | 'highlighter';
  points: number[];
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface LineAnnotation extends AnnotationBase {
  type: 'line';
  points: [number, number, number, number];
  color: string;
  strokeWidth: number;
}

export interface RectAnnotation extends AnnotationBase {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

export interface CircleAnnotation extends AnnotationBase {
  type: 'circle';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  color: string;
  strokeWidth: number;
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

export type AnnotationElement = StrokeAnnotation | LineAnnotation | RectAnnotation | CircleAnnotation | TextAnnotation;

export interface AnnotationDocument {
  version: number;
  noteId: string;
  canvas?: AnnotationCanvas;
  annotations: AnnotationElement[];
}

const MAX_HISTORY = 50;

export function useAnnotations(noteId: string) {
  const [annotations, setAnnotations] = useState<AnnotationElement[]>([]);
  const [tool, setTool] = useState<AnnotationTool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(3);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<AnnotationCanvas | undefined>();
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [annotationsLocked, setAnnotationsLocked] = useState(false);

  const historyRef = useRef<AnnotationElement[][]>([[]]);
  const historyIndexRef = useRef(0);
  const [historyVersion, setHistoryVersion] = useState(0); // trigger re-render for canUndo/canRedo

  // Load annotations when noteId changes
  useEffect(() => {
    if (!noteId) {
      setAnnotations([]);
      setSelectedAnnotationId(null);
      setCanvas(undefined);
      historyRef.current = [[]];
      historyIndexRef.current = 0;
      setHistoryVersion(v => v + 1);
      return;
    }
    setSelectedAnnotationId(null);
    fetch(`${getApiBaseUrl()}/annotations/${noteId}`)
      .then(r => r.ok ? r.json() : { annotations: [] })
      .then((doc: AnnotationDocument) => {
        const loaded = (doc.annotations || []).map((annotation, layer) => ({
          ...annotation,
          visible: annotation.visible !== false,
          locked: Boolean(annotation.locked),
          layer: annotation.layer ?? layer,
        } as AnnotationElement));
        setAnnotations(loaded);
        setCanvas(doc.canvas);
        historyRef.current = [loaded];
        historyIndexRef.current = 0;
        setHistoryVersion(v => v + 1);
      })
      .catch(() => {
        setAnnotations([]);
        setCanvas(undefined);
        historyRef.current = [[]];
        historyIndexRef.current = 0;
        setHistoryVersion(v => v + 1);
      });
  }, [noteId]);

  // Save annotations to backend (debounced)
  useEffect(() => {
    if (!noteId) return;
    const timeout = setTimeout(() => {
      const doc: AnnotationDocument = { version: 2, noteId, canvas, annotations };
      fetch(`${getApiBaseUrl()}/annotations/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      }).catch(err => console.error('Failed to save annotations:', err));
    }, 500);
    return () => clearTimeout(timeout);
  }, [annotations, canvas, noteId]);

  const pushHistory = useCallback((els: AnnotationElement[]) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push([...els]);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
    setHistoryVersion(v => v + 1);
  }, []);

  const addAnnotation = useCallback((el: AnnotationElement) => {
    setAnnotations(prev => {
      const now = new Date().toISOString();
      const next = [...prev, {
        ...el,
        visible: true,
        locked: false,
        layer: prev.length,
        createdAt: now,
        updatedAt: now,
      } as AnnotationElement];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const updateAnnotation = useCallback((id: string, updates: Partial<AnnotationElement>) => {
    setAnnotations(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } as AnnotationElement : a);
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => {
      const next = prev.filter(a => a.id !== id);
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setAnnotations([...historyRef.current[historyIndexRef.current]]);
      setHistoryVersion(v => v + 1);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setAnnotations([...historyRef.current[historyIndexRef.current]]);
      setHistoryVersion(v => v + 1);
    }
  }, []);

  const clearAll = useCallback(() => {
    setAnnotations([]);
    pushHistory([]);
  }, [pushHistory]);

  const toggleSelectedLocked = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations(prev => {
      const next = prev.map(a => a.id === selectedAnnotationId ? {
        ...a,
        locked: !a.locked,
        updatedAt: new Date().toISOString(),
      } as AnnotationElement : a);
      pushHistory(next);
      return next;
    });
  }, [pushHistory, selectedAnnotationId]);

  const toggleSelectedVisible = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations(prev => {
      const next = prev.map(a => a.id === selectedAnnotationId ? {
        ...a,
        visible: a.visible === false,
        updatedAt: new Date().toISOString(),
      } as AnnotationElement : a);
      pushHistory(next);
      return next;
    });
  }, [pushHistory, selectedAnnotationId]);

  const bringSelectedForward = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations(prev => {
      const index = prev.findIndex(a => a.id === selectedAnnotationId);
      if (index < 0 || index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      const relayered = next.map((ann, layer) => ({ ...ann, layer, updatedAt: ann.id === selectedAnnotationId ? new Date().toISOString() : ann.updatedAt }) as AnnotationElement);
      pushHistory(relayered);
      return relayered;
    });
  }, [pushHistory, selectedAnnotationId]);

  const sendSelectedBackward = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations(prev => {
      const index = prev.findIndex(a => a.id === selectedAnnotationId);
      if (index <= 0) return prev;
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      const relayered = next.map((ann, layer) => ({ ...ann, layer, updatedAt: ann.id === selectedAnnotationId ? new Date().toISOString() : ann.updatedAt }) as AnnotationElement);
      pushHistory(relayered);
      return relayered;
    });
  }, [pushHistory, selectedAnnotationId]);

  const updateCanvas = useCallback((nextCanvas: AnnotationCanvas) => {
    setCanvas(prev => {
      if (prev?.width === nextCanvas.width && prev?.height === nextCanvas.height) return prev;
      return nextCanvas;
    });
  }, []);

  const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId) || null;

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  return {
    annotations,
    canvas,
    annotationsVisible,
    setAnnotationsVisible,
    annotationsLocked,
    setAnnotationsLocked,
    tool,
    setTool,
    color,
    setColor,
    brushSize,
    setBrushSize,
    selectedAnnotationId,
    selectedAnnotation,
    setSelectedAnnotationId,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    toggleSelectedLocked,
    toggleSelectedVisible,
    bringSelectedForward,
    sendSelectedBackward,
    updateCanvas,
    undo,
    redo,
    clearAll,
    canUndo,
    canRedo,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _historyVersion: historyVersion, // forces re-render
  };
}
