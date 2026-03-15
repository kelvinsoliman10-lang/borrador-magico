import { useState, useRef } from 'react'
import { Eraser, RotateCcw, Sparkles } from 'lucide-react'
import ImageUploader from './components/ImageUploader'
import MagicCanvas from './components/MagicCanvas'

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [brushSize, setBrushSize] = useState(40);
  const [imageUrl, setImageUrl] = useState(null);
  const canvasRef = useRef(null);

  const handleProcess = async () => {
    if (!canvasRef.current || !imageUrl) return;
    
    setIsProcessing(true);
    setStatusText('Preparando imágenes...');
    
    try {
      const { original, mask } = canvasRef.current.getMaskAndOriginal();
      if (!original || !mask) throw new Error("No se pudo procesar la imagen.");
      
      setStatusText('Consultando IA (Hugging Face via Backend)...');
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          original, 
          mask 
        })
      });

      if (!response.ok) {
        if (response.status === 503) {
            let secondsLeft = 20;
            setStatusText(`IA despertando... (${secondsLeft}s)`);
            const interval = setInterval(() => {
                secondsLeft -= 1;
                if (secondsLeft <= 0) {
                    clearInterval(interval);
                    handleProcess(); // Auto-reintentar
                } else {
                    setStatusText(`IA despertando... (${secondsLeft}s)`);
                }
            }, 1000);
            return; // Esperar al reintento
        }
        
        let errorMsg = `Error HTTP: ${response.status}`;
        if (response.status === 413) {
            errorMsg = "Imagen muy pesada, por favor intenta con una más pequeña";
        } else {
            try {
                const errorData = await response.json();
                console.error("Cuerpo completo del error de la API:", errorData);
                errorMsg = errorData.error || errorMsg;
            } catch(e) {
                console.error("Error al parsear la respuesta de la API:", e);
            }
        }
        
        // Log the full respose object properties for deep diagnosis if not parsable
        console.error("Estado y Cabeceras de la API:", { status: response.status, headers: [...response.headers.entries()] });
        throw new Error(errorMsg);
      }

      setStatusText('Recibiendo imagen final...');
      
      // Hugging Face returns a raw image blob on success
      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      const resultUrl = URL.createObjectURL(blob);
      
      setImageUrl(resultUrl);
    } catch (err) {
      console.error(err);
      alert("Error en el Borrado Mágico: " + (err.message || 'Error de conexión.'));
    } finally {
      if (!statusText.includes(`IA despertando`)) {
          setIsProcessing(false);
          setStatusText('');
      }
    }
  };

  const handleUndo = () => {
    if (canvasRef.current) {
        canvasRef.current.undo();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-emerald-500/30">
      
      {/* Top Navigation / Header */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-lg shadow-lg shadow-emerald-500/20">
              <Eraser className="w-5 h-5 text-gray-950" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
              Borrador Mágico AI
            </h1>
          </div>
        </div>
      </header>

      {/* Top AdSense Banner */}
      <div className="w-full bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-4xl mx-auto h-[90px] bg-gray-800 rounded flex items-center justify-center border border-gray-700/50 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <span className="text-sm font-medium text-gray-500 uppercase tracking-widest relative z-10">Espacio para AdSense</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* Workspace Column */}
        <div className="flex-1 flex flex-col min-h-[500px] h-full">
          
          {/* Controls Bar */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm mb-6 shrink-0 relative z-20">
            
            <div className={`flex items-center gap-4 flex-1 w-full relative transition-opacity duration-300 ${!imageUrl ? 'opacity-50 pointer-events-none' : ''}`}>
              <label htmlFor="brushSize" className="text-sm font-medium text-gray-400 whitespace-nowrap">
                Tamaño del pincel
              </label>
              <input 
                id="brushSize"
                type="range" 
                min="10" 
                max="100" 
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-500 w-8 font-mono">{brushSize}px</span>
            </div>

            <div className={`flex items-center gap-3 w-full sm:w-auto transition-opacity duration-300 ${!imageUrl ? 'opacity-50 pointer-events-none' : ''}`}>
              <button 
                onClick={handleUndo}
                title="Deshacer último trazo"
                className="p-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700 hover:border-gray-600 flex items-center justify-center
                           active:scale-95 transform duration-150"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              
              <button 
                onClick={handleProcess}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-medium 
                           shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2
                           disabled:opacity-70 disabled:cursor-not-allowed active:scale-95 transform duration-150 relative overflow-hidden group"
              >
                  {isProcessing ? (
                    <>
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white relative z-10 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="relative z-10 text-sm whitespace-nowrap">{statusText || 'Procesando...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Borrar mágicamente
                    </>
                  )}
              </button>
            </div>
          </div>

          {/* Canvas / Upload Area */}
          <div className="flex-1 bg-gray-900 rounded-3xl border border-gray-800 flex items-center justify-center relative overflow-hidden group min-h-[400px]">
             {/* Decorative background glow */}
             {!imageUrl && (
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors duration-700 pointer-events-none"></div>
             )}
             
             {imageUrl ? (
                 <MagicCanvas 
                    ref={canvasRef} 
                    imageUrl={imageUrl} 
                    brushSize={brushSize} 
                 />
             ) : (
                 <ImageUploader onImageUpload={setImageUrl} />
             )}
          </div>
        </div>

        {/* Sidebar AdSense */}
        <aside className="w-full lg:w-[300px] shrink-0">
           <div className="sticky top-24">
             <div className="w-full h-[250px] lg:h-[600px] bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-800 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-800/20 to-transparent -translate-y-full group-hover:animate-[shimmer-vertical_2s_infinite]"></div>
                 <span className="text-sm font-medium text-gray-500 uppercase tracking-widest text-center px-4 relative z-10">Espacio para AdSense<br/>(Barra Lateral)</span>
             </div>
           </div>
        </aside>

      </main>
    </div>
  )
}

export default App
