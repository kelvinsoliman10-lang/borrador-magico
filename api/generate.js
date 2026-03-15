export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { original, mask } = req.body;
    if (!original || !mask) {
      return res.status(400).json({ error: 'Imágenes originales o máscara faltantes' });
    }

    // Vercel y Vite leen las variables de entorno inyectadas
    const hfToken = process.env.VITE_HF_API_TOKEN;
    
    if (!hfToken) {
      return res.status(401).json({ error: 'Falta el Token de API (VITE_HF_API_TOKEN) en las variables de entorno de Vercel.' });
    }
    
    // Intentamos con el router oficial sin el prefijo hf-inference que puede dar 404
    // URLs a probar en orden de modernidad/estabilidad
    const urls = [
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-2-inpainting",
      "https://router.huggingface.co/models/stabilityai/stable-diffusion-2-inpainting",
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-inpainting"
    ];

    // Limpieza de Base64 usando el regex solicitado
    const cleanB64 = (str) => str.replace(/^data:image\/\w+;base64,/, "");

    const payload = JSON.stringify({
      inputs: {
        image: cleanB64(original),
        mask: cleanB64(mask)
      }
    });

    let response;
    let lastError;

    for (const url of urls) {
      try {
        console.log(`Intentando: ${url}`);
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json"
          },
          body: payload
        });

        if (response.ok || response.status === 503) {
          // Si es exitoso o es el error 503 (Cargando modelo), nos quedamos con esta URL
          break;
        }
        
        const errType = await response.text();
        lastError = `Status ${response.status}: ${errType}`;
        console.warn(`Fallo en ${url}: ${lastError}`);
      } catch (e) {
        lastError = e.message;
        console.error(`Error de red en ${url}:`, e);
      }
    }

    // Si después de todos los intentos no tenemos un response decente
    if (!response || (!response.ok && response.status !== 503)) {
      return res.status(response?.status || 500).json({ 
        error: "No se pudo conectar con ningún endpoint de Hugging Face.",
        details: lastError 
      });
    }

    // Si Hugging Face devuelve error (503 cargando, etc), reenviamos esos errores 1:1 al frontend
    if (!response.ok) {
      const errorText = await response.text();
      let errorObj;
      try {
        errorObj = JSON.parse(errorText); // Intentar mapear JSON de error
      } catch (e) {
        errorObj = { error: errorText }; // Si es HTML o texto plano
      }
      return res.status(response.status).json(errorObj);
    }

    // Convertimos la respuesta exitosa (una imagen binaria) a Buffer para servirla de vuelta
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
    res.status(200).send(buffer);

  } catch (err) {
    console.error('Server error HF proxy:', err);
    res.status(500).json({ error: err.message || 'Error de servidor interno.' });
  }
}
