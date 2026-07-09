import { useRef, useState, useEffect, useCallback, RefObject } from 'react';
import { Stage, Layer, Line, Rect as KonvaRect, Ellipse, Text as KonvaText, Transformer } from 'react-konva';
import Konva from 'konva';
import { AnnotationElement, AnnotationTool, StrokeAnnotation, LineAnnotation, RectAnnotation, CircleAnnotation, TextAnnotation } from './useAnnotations';

interface AnnotationOverlayProps {
  annotations: AnnotationElement[];
  onAddAnnotation: (el: AnnotationElement) => void;
  onUpdateAnnotation: (id: string, updates: Partial<AnnotationElement>) => void;
  onDeleteAnnotation: (id: string) => void;
  tool: AnnotationTool;
  color: string;
  brushSize: number;
  active: boolean;
  visible: boolean;
  locked: boolean;
  contentRef: RefObject<HTMLDivElement>;
  selectedId: string | null;
  onSelectionChange: (id: string | null) => void;
  onCanvasSizeChange?: (size: { width: number; height: number }) => void;
}

const genId = () => `ann-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export const AnnotationOverlay = ({
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  tool,
  color,
  brushSize,
  active,
  visible,
  locked,
  contentRef,
  selectedId,
  onSelectionChange,
  onCanvasSizeChange,
}: AnnotationOverlayProps) => {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [previewShape, setPreviewShape] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const updateSize = useCallback((next: { width: number; height: number }) => {
    setSize((prev) => {
      if (prev.width === next.width && prev.height === next.height) return prev;
      return next;
    });
    onCanvasSizeChange?.(next);
  }, [onCanvasSizeChange]);

  // Track content size with ResizeObserver
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      updateSize({
        width: Math.ceil(Math.max(width, el.scrollWidth)),
        height: Math.ceil(Math.max(height, el.scrollHeight)),
      });
    });
    ro.observe(el);
    // Initial measurement
    updateSize({
      width: Math.ceil(Math.max(el.clientWidth, el.scrollWidth)),
      height: Math.ceil(Math.max(el.clientHeight, el.scrollHeight)),
    });
    return () => ro.disconnect();
  }, [contentRef, updateSize]);

  // Update transformer
  useEffect(() => {
    if (transformerRef.current && stageRef.current) {
      const selected = annotations.find((ann) => ann.id === selectedId);
      if (selectedId && active && tool === 'pan' && visible && selected?.visible !== false && !selected?.locked && !locked) {
        const node = stageRef.current.findOne(`#${selectedId}`);
        if (node) {
          transformerRef.current.nodes([node]);
          transformerRef.current.getLayer()?.batchDraw();
          return;
        }
      }
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, active, tool, visible, annotations, locked]);

  const distanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  const splitStrokeAtPoint = useCallback((stroke: StrokeAnnotation, pos: { x: number; y: number }, radius: number) => {
    const segments: number[][] = [];
    let current: number[] = [];

    for (let i = 0; i < stroke.points.length; i += 2) {
      const x = stroke.points[i];
      const y = stroke.points[i + 1];
      const prevX = i >= 2 ? stroke.points[i - 2] : x;
      const prevY = i >= 2 ? stroke.points[i - 1] : y;
      const hit = distanceToSegment(pos.x, pos.y, prevX, prevY, x, y) <= radius;

      if (hit) {
        if (current.length > 4) segments.push(current);
        current = [];
      } else {
        current.push(x, y);
      }
    }

    if (current.length > 4) segments.push(current);
    return segments;
  }, []);

  // Clear selection when deactivating
  useEffect(() => {
    if (!active) {
      onSelectionChange(null);
      setIsDrawing(false);
      setCurrentPoints([]);
      setShapeStart(null);
      setPreviewShape(null);
    }
  }, [active]);

  useEffect(() => {
    if (tool !== 'pan') {
      onSelectionChange(null);
    }
  }, [tool, onSelectionChange]);

  const eraseAtPointer = useCallback(() => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!stage || !pos) return;
    const node = stage.getIntersection(pos);
    const id = node?.id();
    const target = annotations.find((ann) => ann.id === id);
    if (!target || target.locked || locked || target.visible === false) return;

    if (target.type === 'stroke') {
      const radius = Math.max(8, brushSize * 2.5);
      const segments = splitStrokeAtPoint(target, pos, radius);
      onDeleteAnnotation(id);
      segments.forEach((points, index) => {
        onAddAnnotation({
          ...target,
          id: `${target.id}-split-${Date.now()}-${index}`,
          points,
          createdAt: target.createdAt,
          updatedAt: new Date().toISOString(),
        });
      });
      onSelectionChange(null);
      return;
    }

    if (id?.startsWith('ann-')) {
      onDeleteAnnotation(id);
      onSelectionChange(null);
    }
  }, [annotations, brushSize, locked, onAddAnnotation, onDeleteAnnotation, onSelectionChange, splitStrokeAtPoint]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!active || !visible) return;
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const clickedOnEmpty = e.target === e.target.getStage();

    if (tool === 'pan') {
      if (clickedOnEmpty) onSelectionChange(null);
      return;
    }

    if (tool === 'eraser') {
      setIsDrawing(true);
      eraseAtPointer();
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      setIsDrawing(true);
      setCurrentPoints([pos.x, pos.y]);
      onSelectionChange(null);
    } else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      setIsDrawing(true);
      setShapeStart(pos);
      setPreviewShape({ x: pos.x, y: pos.y, w: 0, h: 0 });
      onSelectionChange(null);
    } else if (tool === 'text' && clickedOnEmpty) {
      const newEl: TextAnnotation = {
        id: genId(),
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: 'Text',
        fontSize: 20,
        color,
      };
      onAddAnnotation(newEl);
      onSelectionChange(newEl.id);
    } else if (clickedOnEmpty) {
      onSelectionChange(null);
    }
  }, [active, tool, color, onAddAnnotation, onSelectionChange, eraseAtPointer]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing || !active || !visible) return;
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (tool === 'eraser') {
      eraseAtPointer();
    } else if (tool === 'pen' || tool === 'highlighter') {
      setCurrentPoints(prev => [...prev, pos.x, pos.y]);
    } else if ((tool === 'line' || tool === 'rect' || tool === 'circle') && shapeStart) {
      setPreviewShape({
        x: Math.min(shapeStart.x, pos.x),
        y: Math.min(shapeStart.y, pos.y),
        w: pos.x - shapeStart.x,
        h: pos.y - shapeStart.y,
      });
    }
  }, [isDrawing, active, tool, shapeStart, eraseAtPointer]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !active || !visible) return;

    if ((tool === 'pen' || tool === 'highlighter') && currentPoints.length > 2) {
      const newEl: StrokeAnnotation = {
        id: genId(),
        type: 'stroke',
        tool: tool as 'pen' | 'highlighter',
        points: currentPoints,
        color,
        strokeWidth: tool === 'highlighter' ? brushSize * 4 : brushSize,
        opacity: tool === 'highlighter' ? 0.24 : 1,
      };
      onAddAnnotation(newEl);
    } else if (tool === 'line' && shapeStart) {
      const stage = stageRef.current;
      const pos = stage?.getPointerPosition();
      if (pos) {
        const newEl: LineAnnotation = {
          id: genId(),
          type: 'line',
          points: [shapeStart.x, shapeStart.y, pos.x, pos.y],
          color,
          strokeWidth: brushSize,
        };
        onAddAnnotation(newEl);
      }
    } else if (tool === 'rect' && shapeStart) {
      const stage = stageRef.current;
      const pos = stage?.getPointerPosition();
      if (pos) {
        const x = Math.min(shapeStart.x, pos.x);
        const y = Math.min(shapeStart.y, pos.y);
        const w = Math.abs(pos.x - shapeStart.x);
        const h = Math.abs(pos.y - shapeStart.y);
        if (w > 2 && h > 2) {
          const newEl: RectAnnotation = {
            id: genId(),
            type: 'rect',
            x, y, width: w, height: h,
            color,
            strokeWidth: brushSize,
          };
          onAddAnnotation(newEl);
        }
      }
    } else if (tool === 'circle' && shapeStart) {
      const stage = stageRef.current;
      const pos = stage?.getPointerPosition();
      if (pos) {
        const cx = (shapeStart.x + pos.x) / 2;
        const cy = (shapeStart.y + pos.y) / 2;
        const rx = Math.abs(pos.x - shapeStart.x) / 2;
        const ry = Math.abs(pos.y - shapeStart.y) / 2;
        if (rx > 2 && ry > 2) {
          const newEl: CircleAnnotation = {
            id: genId(),
            type: 'circle',
            x: cx, y: cy, radiusX: rx, radiusY: ry,
            color,
            strokeWidth: brushSize,
          };
          onAddAnnotation(newEl);
        }
      }
    }

    setIsDrawing(false);
    setCurrentPoints([]);
    setShapeStart(null);
    setPreviewShape(null);
  }, [isDrawing, active, tool, currentPoints, shapeStart, color, brushSize, onAddAnnotation]);

  const updateNodeGeometry = useCallback((id: string, node: Konva.Node, ann: AnnotationElement) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    if (ann.type === 'stroke' || ann.type === 'line') {
      const line = node as Konva.Line;
      const dx = line.x();
      const dy = line.y();
      const points = line.points().map((point, index) => point * (index % 2 === 0 ? scaleX : scaleY) + (index % 2 === 0 ? dx : dy));
      line.position({ x: 0, y: 0 });
      line.scale({ x: 1, y: 1 });
      onUpdateAnnotation(id, { points } as Partial<AnnotationElement>);
      return;
    }

    if (ann.type === 'rect') {
      const rect = node as Konva.Rect;
      const width = Math.max(1, rect.width() * scaleX);
      const height = Math.max(1, rect.height() * scaleY);
      rect.scale({ x: 1, y: 1 });
      onUpdateAnnotation(id, { x: rect.x(), y: rect.y(), width, height } as Partial<AnnotationElement>);
      return;
    }

    if (ann.type === 'circle') {
      const ellipse = node as Konva.Ellipse;
      const radiusX = Math.max(1, ellipse.radiusX() * scaleX);
      const radiusY = Math.max(1, ellipse.radiusY() * scaleY);
      ellipse.scale({ x: 1, y: 1 });
      onUpdateAnnotation(id, { x: ellipse.x(), y: ellipse.y(), radiusX, radiusY } as Partial<AnnotationElement>);
      return;
    }

    if (ann.type === 'text') {
      const text = node as Konva.Text;
      const fontSize = Math.max(8, ann.fontSize * Math.max(scaleX, scaleY));
      text.scale({ x: 1, y: 1 });
      onUpdateAnnotation(id, { x: text.x(), y: text.y(), fontSize } as Partial<AnnotationElement>);
    }
  }, [onUpdateAnnotation]);

  const commonNodeProps = (ann: AnnotationElement) => ({
    draggable: active && visible && tool === 'pan' && !ann.locked && !locked,
    listening: active && visible && (tool === 'pan' || tool === 'eraser') && ann.visible !== false,
    onClick: () => active && visible && tool === 'pan' && !ann.locked && !locked && onSelectionChange(ann.id),
    onTap: () => active && visible && tool === 'pan' && !ann.locked && !locked && onSelectionChange(ann.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => !ann.locked && !locked && updateNodeGeometry(ann.id, e.target, ann),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => !ann.locked && !locked && updateNodeGeometry(ann.id, e.target, ann),
  });

  // Text double-click edit
  const handleTextDblClick = useCallback((ann: TextAnnotation) => {
    const stage = stageRef.current;
    const textNode = stage?.findOne(`#${ann.id}`) as Konva.Text | undefined;
    if (!stage || !textNode) return;

    textNode.hide();
    transformerRef.current?.hide();

    const textPos = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = ann.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${stageBox.top + textPos.y}px`;
    textarea.style.left = `${stageBox.left + textPos.x}px`;
    textarea.style.width = `${Math.max(100, textNode.width())}px`;
    textarea.style.fontSize = `${ann.fontSize}px`;
    textarea.style.border = '2px solid hsl(var(--primary))';
    textarea.style.padding = '4px';
    textarea.style.background = 'hsl(var(--background))';
    textarea.style.color = ann.color;
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.zIndex = '1000';
    textarea.focus();
    setEditingTextId(ann.id);

    const remove = () => {
      if (textarea.parentNode) {
        onUpdateAnnotation(ann.id, { text: textarea.value || 'Text' } as Partial<TextAnnotation>);
        document.body.removeChild(textarea);
      }
      textNode.show();
      transformerRef.current?.show();
      setEditingTextId(null);
    };

    textarea.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) remove();
      if (ev.key === 'Escape') remove();
    });
    textarea.addEventListener('blur', remove);
  }, [onUpdateAnnotation]);

  const getCursor = () => {
    if (!active) return 'default';
    switch (tool) {
      case 'pen': case 'highlighter': case 'eraser': return 'crosshair';
      case 'text': return 'text';
      case 'pan': return 'grab';
      default: return 'crosshair';
    }
  };

  const renderAnnotation = (ann: AnnotationElement) => {
    if (ann.visible === false || !visible) return null;
    switch (ann.type) {
      case 'stroke': {
        const s = ann as StrokeAnnotation;
        const strokeOpacity = s.tool === 'highlighter'
          ? Math.min(s.opacity ?? 0.24, 0.35)
          : s.opacity ?? 1;
        return (
          <Line
            key={s.id}
            id={s.id}
            points={s.points}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            opacity={s.locked ? Math.min(strokeOpacity, 0.7) : strokeOpacity}
            globalCompositeOperation={s.tool === 'eraser' ? 'destination-out' : 'source-over'}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            {...commonNodeProps(s)}
          />
        );
      }
      case 'line': {
        const l = ann as LineAnnotation;
        return (
          <Line
            key={l.id}
            id={l.id}
            points={l.points}
            stroke={l.color}
            strokeWidth={l.strokeWidth}
            opacity={l.locked ? 0.7 : 1}
            lineCap="round"
            {...commonNodeProps(l)}
          />
        );
      }
      case 'rect': {
        const r = ann as RectAnnotation;
        return (
          <KonvaRect
            key={r.id}
            id={r.id}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            stroke={r.color}
            strokeWidth={r.strokeWidth}
            opacity={r.locked ? 0.7 : 1}
            {...commonNodeProps(r)}
          />
        );
      }
      case 'circle': {
        const c = ann as CircleAnnotation;
        return (
          <Ellipse
            key={c.id}
            id={c.id}
            x={c.x}
            y={c.y}
            radiusX={c.radiusX}
            radiusY={c.radiusY}
            stroke={c.color}
            strokeWidth={c.strokeWidth}
            opacity={c.locked ? 0.7 : 1}
            {...commonNodeProps(c)}
          />
        );
      }
      case 'text': {
        const t = ann as TextAnnotation;
        return (
          <KonvaText
            key={t.id}
            id={t.id}
            x={t.x}
            y={t.y}
            text={t.text}
            fontSize={t.fontSize}
            fill={t.color}
            opacity={t.locked ? 0.7 : 1}
            visible={editingTextId !== t.id}
            {...commonNodeProps(t)}
            onDblClick={() => active && tool === 'pan' && handleTextDblClick(t)}
            onDblTap={() => active && tool === 'pan' && handleTextDblClick(t)}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      className="absolute top-0 left-0 z-10"
      style={{
        width: size.width,
        height: size.height,
        pointerEvents: active && visible ? 'auto' : 'none',
        cursor: getCursor(),
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          {/* Saved annotations */}
          {annotations
            .slice()
            .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
            .map(renderAnnotation)}

          {/* Current freehand stroke preview */}
          {visible && isDrawing && (tool === 'pen' || tool === 'highlighter') && currentPoints.length > 0 && (
            <Line
              points={currentPoints}
              stroke={color}
              strokeWidth={tool === 'highlighter' ? brushSize * 4 : brushSize}
              opacity={tool === 'highlighter' ? 0.24 : 1}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Shape preview */}
          {visible && isDrawing && tool === 'line' && shapeStart && previewShape && (
            <Line
              points={[shapeStart.x, shapeStart.y, shapeStart.x + previewShape.w, shapeStart.y + previewShape.h]}
              stroke={color}
              strokeWidth={brushSize}
              lineCap="round"
              dash={[5, 5]}
            />
          )}
          {visible && isDrawing && tool === 'rect' && previewShape && (
            <KonvaRect
              x={previewShape.x}
              y={previewShape.y}
              width={Math.abs(previewShape.w)}
              height={Math.abs(previewShape.h)}
              stroke={color}
              strokeWidth={brushSize}
              dash={[5, 5]}
            />
          )}
          {visible && isDrawing && tool === 'circle' && shapeStart && previewShape && (
            <Ellipse
              x={(shapeStart.x + shapeStart.x + previewShape.w) / 2}
              y={(shapeStart.y + shapeStart.y + previewShape.h) / 2}
              radiusX={Math.abs(previewShape.w) / 2}
              radiusY={Math.abs(previewShape.h) / 2}
              stroke={color}
              strokeWidth={brushSize}
              dash={[5, 5]}
            />
          )}

          {active && visible && tool === 'pan' && !locked && (
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                return newBox;
              }}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};
