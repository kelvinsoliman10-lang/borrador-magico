import { useCallback, useState } from 'react';

export default function ImageUploader({ onImageUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = (file) => {
    setError('');
    if (!file) return;
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setError('Por favor, sube un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }
    
    // Check size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen es demasiado grande. El límite es 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      onImageUpload(e.target.result);
    };
    reader.onerror = () => {
      setError('Error al leer el archivo.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div 
      className={`text-center relative z-10 flex flex-col items-center max-w-md p-8 rounded-3xl border-2 border-dashed transition-all duration-300 w-full ${
        isDragging 
          ? 'border-emerald-500 bg-emerald-500/10' 
          : 'border-gray-700 hover:border-gray-600 bg-transparent'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className={`w-16 h-16 rounded-2xl border mb-6 flex items-center justify-center shadow-lg transition-transform duration-300 ${
        isDragging 
          ? 'bg-emerald-500/20 border-emerald-500 scale-110' 
          : 'bg-gray-800 border-gray-700 group-hover:scale-105'
      }`}>
        <svg 
          className={`w-8 h-8 transition-colors ${isDragging ? 'text-emerald-400' : 'text-gray-400 group-hover:text-emerald-400'}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-2">Sube una imagen para empezar</h3>
      
      <p className="text-gray-400 text-sm mb-2 leading-relaxed">
        Haz clic o arrastra una imagen aquí. El tamaño máximo de archivo es 10MB.
      </p>
      
      {error && (
        <p className="text-red-400 text-sm mb-4 font-medium px-4 py-2 bg-red-400/10 rounded-lg outline outline-1 outline-red-400/20">
          {error}
        </p>
      )}

      <div className={error ? "mt-4" : "mt-8"}>
        <input 
          type="file" 
          id="file-upload" 
          className="hidden" 
          accept="image/*"
          onChange={handleChange}
        />
        <label 
          htmlFor="file-upload"
          className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium border border-gray-700 hover:border-gray-500 transition-colors cursor-pointer active:scale-95 inline-block"
        >
          Seleccionar Imagen
        </label>
      </div>
    </div>
  );
}
