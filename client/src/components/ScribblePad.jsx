import { useCallback, useEffect, useRef, useState } from "react";
import { FaPen, FaTrash } from "react-icons/fa";

function ScribblePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  const getContext = () => canvasRef.current?.getContext("2d");

  const paintBackground = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#0f172a";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  useEffect(() => {
    paintBackground();
    // Resizing is intentionally not handled because it would erase a candidate's sketch.
  }, [paintBackground]);

  const pointFromEvent = (event) => {
    const canvas = canvasRef.current;
    const box = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) * (canvas.width / box.width),
      y: (event.clientY - box.top) * (canvas.height / box.height),
    };
  };

  const beginDrawing = (event) => {
    const canvas = canvasRef.current;
    const context = getContext();
    if (!canvas || !context) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    const context = getContext();
    if (!context) return;
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasDrawing(true);
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    paintBackground();
    setHasDrawing(false);
    onChange("");
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-white px-4 py-3">
        <div><p className="flex items-center gap-2 text-sm font-semibold text-gray-800"><FaPen className="text-amber-600" /> Optional scribble pad</p><p className="mt-0.5 text-xs text-gray-500">Draw a diagram, dry run, UML class design, SQL plan, or pseudocode. AI will inspect it with your answer.</p></div>
        <button type="button" onClick={clear} disabled={!hasDrawing} className="flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"><FaTrash /> Clear</button>
      </div>
      <canvas ref={canvasRef} width="1200" height="560" onPointerDown={beginDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} className="block h-65 w-full touch-none cursor-crosshair bg-white" aria-label="Scribble pad" />
      {!hasDrawing && <p className="border-t border-amber-100 px-4 py-2 text-xs text-amber-800">Drawing is optional. Your image remains part of this answer evaluation only.</p>}
    </section>
  );
}

export default ScribblePad;
