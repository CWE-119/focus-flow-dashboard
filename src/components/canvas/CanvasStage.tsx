import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Image as KonvaImage, Text as KonvaText, Transformer } from 'react-konva';
import Konva from 'konva';
import { CanvasNode, PathNode, ImageNode, TextNode, Tool, NewCanvasNode, NewPathNode, NewTextNode } from './types';

interface CanvasStageProps {
  nodes: CanvasNode[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  tool: Tool;
  strokeColor: string;
  strokeWidth: number;
  addNode: (node: NewCanvasNode) => string;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

interface LoadedImage {
  id: string;
  image: HTMLImageElement;
}

export const CanvasStage = ({
  nodes,
  selectedIds,
  setSelectedIds,
  tool,
  strokeColor,
  strokeWidth,
  addNode,
  updateNode,
  stageRef,
}: CanvasStageProps) => {
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<number[]>([]);
  const [loadedImages, setLoadedImages] = useState<LoadedImage[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const loadedImageSrcRef = useRef(new Map<string, string>());
  const loadingImageSrcRef = useRef(new Map<string, string>());

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load images
  useEffect(() => {
    const imageNodes = nodes.filter((n): n is ImageNode => n.type === 'image');
    const imageNodeIds = new Set(imageNodes.map((node) => node.id));

    for (const id of loadedImageSrcRef.current.keys()) {
      if (!imageNodeIds.has(id)) loadedImageSrcRef.current.delete(id);
    }
    for (const id of loadingImageSrcRef.current.keys()) {
      if (!imageNodeIds.has(id)) loadingImageSrcRef.current.delete(id);
    }

    setLoadedImages(prev => {
      const next = prev.filter(li => imageNodeIds.has(li.id));
      return next.length === prev.length ? prev : next;
    });

    imageNodes.forEach(node => {
      if (loadedImageSrcRef.current.get(node.id) === node.src) return;
      if (loadingImageSrcRef.current.get(node.id) === node.src) return;

      loadingImageSrcRef.current.set(node.id, node.src);
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = node.src;
      img.onload = () => {
        loadingImageSrcRef.current.delete(node.id);
        loadedImageSrcRef.current.set(node.id, node.src);
        setLoadedImages(prev => [...prev.filter(li => li.id !== node.id), { id: node.id, image: img }]);
      };
      img.onerror = () => {
        loadingImageSrcRef.current.delete(node.id);
      };
    });
  }, [nodes]);

  // Update transformer
  useEffect(() => {
    if (transformerRef.current && stageRef.current) {
      const selectedNodes = selectedIds
        .map(id => stageRef.current?.findOne(`#${id}`))
        .filter(Boolean) as Konva.Node[];
      transformerRef.current.nodes(selectedNodes);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedIds, stageRef]);

  const getCursor = () => {
    switch (tool) {
      case 'draw': return 'crosshair';
      case 'erase': return 'crosshair';
      case 'text': return 'text';
      default: return 'default';
    }
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Click on empty space
    const clickedOnEmpty = e.target === stage;

    if (tool === 'select') {
      if (clickedOnEmpty) {
        setSelectedIds([]);
      }
    } else if (tool === 'draw' || tool === 'erase') {
      setIsDrawing(true);
      setCurrentPath([pos.x, pos.y]);
    } else if (tool === 'text' && clickedOnEmpty) {
      const newTextNode: NewTextNode = {
        type: 'text',
        text: 'Double-click to edit',
        x: pos.x,
        y: pos.y,
        fontSize: 20,
        fill: strokeColor,
      };
      const id = addNode(newTextNode);
      setSelectedIds([id]);
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing || (tool !== 'draw' && tool !== 'erase')) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    setCurrentPath(prev => [...prev, pos.x, pos.y]);
  };

  const handleMouseUp = () => {
    if (isDrawing && currentPath.length > 2) {
      const newPathNode: NewPathNode = {
        type: 'path',
        points: currentPath,
        stroke: tool === 'erase' ? '#000000' : strokeColor,
        strokeWidth: strokeWidth,
        x: 0,
        y: 0,
        isEraser: tool === 'erase',
      };
      addNode(newPathNode);
    }
    setIsDrawing(false);
    setCurrentPath([]);
  };

  const handleMouseLeave = () => {
    if (isDrawing && currentPath.length > 2) {
      const newPathNode: NewPathNode = {
        type: 'path',
        points: currentPath,
        stroke: tool === 'erase' ? '#000000' : strokeColor,
        strokeWidth: strokeWidth,
        x: 0,
        y: 0,
        isEraser: tool === 'erase',
      };
      addNode(newPathNode);
    }
    setIsDrawing(false);
    setCurrentPath([]);
  };

  const handleNodeClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent | Event>, nodeId: string) => {
    if (tool !== 'select') return;
    e.cancelBubble = true;
    setSelectedIds([nodeId]);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>, nodeId: string) => {
    updateNode(nodeId, { x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>, node: CanvasNode) => {
    const konvaNode = e.target as Konva.Node;
    const scaleX = konvaNode.scaleX();
    const scaleY = konvaNode.scaleY();

    // Reset scale and apply to width/height
    konvaNode.scaleX(1);
    konvaNode.scaleY(1);

    if (node.type === 'image') {
      updateNode(node.id, {
        x: konvaNode.x(),
        y: konvaNode.y(),
        width: Math.max(5, (node as ImageNode).width * scaleX),
        height: Math.max(5, (node as ImageNode).height * scaleY),
        rotation: konvaNode.rotation(),
      });
    } else if (node.type === 'text') {
      updateNode(node.id, {
        x: konvaNode.x(),
        y: konvaNode.y(),
        fontSize: Math.max(8, (node as TextNode).fontSize * scaleX),
        rotation: konvaNode.rotation(),
      });
    }
  };

  const handleTextDblClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent> | Konva.KonvaEventObject<Event>, node: TextNode) => {
    const textNode = e.target as Konva.Text;
    const stage = stageRef.current;
    if (!stage) return;

    // Hide text temporarily
    textNode.hide();
    transformerRef.current?.hide();

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    textarea.value = node.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${stageBox.top + textPosition.y}px`;
    textarea.style.left = `${stageBox.left + textPosition.x}px`;
    textarea.style.width = `${Math.max(textNode.width() * textNode.scaleX(), 100)}px`;
    textarea.style.fontSize = `${node.fontSize}px`;
    textarea.style.border = '2px solid hsl(var(--primary))';
    textarea.style.padding = '4px';
    textarea.style.margin = '0';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'hsl(var(--background))';
    textarea.style.color = node.fill;
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.fontFamily = 'inherit';
    textarea.style.zIndex = '1000';

    textarea.focus();

    const removeTextarea = () => {
      if (textarea.parentNode) {
        updateNode(node.id, { text: textarea.value || 'Text' });
        document.body.removeChild(textarea);
      }
      textNode.show();
      transformerRef.current?.show();
      setEditingTextId(null);
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        removeTextarea();
      }
      if (e.key === 'Escape') {
        removeTextarea();
      }
    });
    textarea.addEventListener('blur', removeTextarea);
    setEditingTextId(node.id);
  };

  return (
    <div ref={containerRef} className="flex-1 bg-muted/30" style={{ cursor: getCursor() }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          {/* Render regular paths */}
          {nodes.filter((n): n is PathNode => n.type === 'path' && !n.isEraser).map((node) => (
            <Line
              key={node.id}
              id={node.id}
              points={node.points}
              stroke={node.stroke}
              strokeWidth={node.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation="source-over"
            />
          ))}

          {/* Render eraser paths */}
          {nodes.filter((n): n is PathNode => n.type === 'path' && n.isEraser).map((node) => (
            <Line
              key={node.id}
              id={node.id}
              points={node.points}
              stroke={node.stroke}
              strokeWidth={node.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation="destination-out"
            />
          ))}

          {/* Render images */}
          {nodes.filter((n): n is ImageNode => n.type === 'image').map((node) => {
            const loaded = loadedImages.find(li => li.id === node.id);
            if (!loaded) return null;
            return (
              <KonvaImage
                key={node.id}
                id={node.id}
                image={loaded.image}
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rotation={node.rotation || 0}
                draggable={tool === 'select'}
                onClick={(e) => handleNodeClick(e, node.id)}
                onTap={(e) => handleNodeClick(e, node.id)}
                onDragEnd={(e) => handleDragEnd(e, node.id)}
                onTransformEnd={(e) => handleTransformEnd(e, node)}
              />
            );
          })}

          {/* Render text */}
          {nodes.filter((n): n is TextNode => n.type === 'text').map((node) => (
            <KonvaText
              key={node.id}
              id={node.id}
              text={node.text}
              x={node.x}
              y={node.y}
              fontSize={node.fontSize}
              fill={node.fill}
              rotation={node.rotation || 0}
              draggable={tool === 'select'}
              onClick={(e) => handleNodeClick(e, node.id)}
              onTap={(e) => handleNodeClick(e, node.id)}
              onDragEnd={(e) => handleDragEnd(e, node.id)}
              onTransformEnd={(e) => handleTransformEnd(e, node)}
              onDblClick={(e) => handleTextDblClick(e, node)}
              onDblTap={(e) => handleTextDblClick(e, node)}
              visible={editingTextId !== node.id}
            />
          ))}

          {/* Current drawing path */}
          {isDrawing && currentPath.length > 0 && (
            <Line
              points={currentPath}
              stroke={tool === 'erase' ? '#ffffff' : strokeColor}
              strokeWidth={strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={tool === 'erase' ? 'destination-out' : 'source-over'}
            />
          )}

          {/* Transformer for selected items */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
};
