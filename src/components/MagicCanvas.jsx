import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

const MagicCanvas = forwardRef(({ imageUrl, brushSize }, ref) => {
  const containerRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Ref for storing the drawing history to avoid re-renders on every stroke
  const historyRef = useRef([]);
  const currentPathRef = useRef(null);

  // Expose undo method to parent
  useImperativeHandle(ref, () => ({
    undo: () => {
      if (historyRef.current.length > 0) {
        historyRef.current.pop();
        redrawMask();
      }
    },
    getMaskAndOriginal: () => {
      if (!dimensions.width || !dimensions.height) return null;
      
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = dimensions.width;
      maskCanvas.height = dimensions.height;
      const ctx = maskCanvas.getContext('2d');
      
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      historyRef.current.forEach(path => {
        if (path.points.length === 0) return;
        ctx.beginPath();
        ctx.strokeStyle = 'white';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = path.size;

        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      });

      const origCanvas = document.createElement('canvas');
      origCanvas.width = dimensions.width;
      origCanvas.height = dimensions.height;
      const origCtx = origCanvas.getContext('2d');
      if (imageCanvasRef.current) {
        origCtx.drawImage(imageCanvasRef.current, 0, 0, dimensions.width, dimensions.height);
      }
      
      return {
        original: origCanvas.toDataURL('image/jpeg', 0.9),
        mask: maskCanvas.toDataURL('image/jpeg', 0.9)
      };
    }
  }));

  // Load image and set dimensions
  useEffect(() => {
    if (!imageUrl) return;

    // Reset history when image changes
    historyRef.current = [];
    if (drawingCanvasRef.current) {
        const ctx = drawingCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
    }

    const img = new Image();
    img.onload = () => {
      // Calculate responsive dimensions while maintaining aspect ratio
      const containerWidth = containerRef.current?.clientWidth || 800;
      const containerHeight = containerRef.current?.clientHeight || 600;
      
      let newWidth = img.width;
      let newHeight = img.height;
      const ratio = img.width / img.height;

      // Fit within container
      if (newWidth > containerWidth || newHeight > containerHeight) {
        if (containerWidth / ratio <= containerHeight) {
          newWidth = containerWidth;
          newHeight = containerWidth / ratio;
        } else {
          newHeight = containerHeight;
          newWidth = containerHeight * ratio;
        }
      }

      setDimensions({ width: newWidth, height: newHeight });

      // Draw background image
      const ctx = imageCanvasRef.current?.getContext('2d');
      if (ctx && imageCanvasRef.current) {
        // Wait for dimensions to update in DOM before drawing
        setTimeout(() => {
          ctx.clearRect(0, 0, newWidth, newHeight);
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
        }, 50);
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const redrawMask = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    historyRef.current.forEach(path => {
      drawPath(ctx, path);
    });
  };

  const drawPath = (ctx, path) => {
    if (path.points.length === 0) return;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'; // Emerald-500 semi-transparent
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = path.size;

    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.stroke();
  };

  const getCoordinates = (e) => {
    const canvas = drawingCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Support touch and mouse events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    setIsDrawing(true);
    
    // Start a new path
    currentPathRef.current = {
        size: brushSize,
        points: [coords]
    };

    // Draw initial dot
    const ctx = drawingCanvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    const ctx = drawingCanvasRef.current.getContext('2d');
    
    // Ensure styles are set
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    // Draw from last point to current point
    const lastPoint = currentPathRef.current.points[currentPathRef.current.points.length - 1];
    
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    currentPathRef.current.points.push(coords);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Save path to history
    if (currentPathRef.current && currentPathRef.current.points.length > 0) {
        historyRef.current.push(currentPathRef.current);
    }
    currentPathRef.current = null;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
    >
      <div 
        className="relative shadow-2xl rounded-lg overflow-hidden ring-1 ring-gray-700/50"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {/* Background Image layer */}
        <canvas
          ref={imageCanvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 z-0 bg-transparent block"
        />
        
        {/* Foreground Mask layer */}
        <canvas
          ref={drawingCanvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 z-10 touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />
      </div>
    </div>
  );
});

MagicCanvas.displayName = 'MagicCanvas';

export default MagicCanvas;
