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
    
    // Limpieza de Base64 usando el regex solicitado
    const cleanB64 = (str) => str.replace(/^data:image\/\w+;base64,/, "");
    const imgClean = cleanB64(original);
    const mskClean = cleanB64(mask);

    // Intentamos diferentes combinaciones de URLs y formatos de Payloads
    // Algunos modelos esperan {inputs: {image, mask}}, otros {image, mask_image, inputs: "prompt"}
    const configs = [
      { 
        url: "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-2-inpainting", 
        body: { inputs: { image: imgClean, mask: mskClean } } 
      },
      { 
        url: "https://router.huggingface.co/models/stabilityai/stable-diffusion-2-inpainting", 
        body: { inputs: { image: imgClean, mask: mskClean } } 
      },
      { 
        url: "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-inpainting", 
        body: { image: imgClean, mask_image: mskClean, inputs: "remove background object" } 
      },
      { 
        url: "https://router.huggingface.co/hf-inference/models/stable-diffusion-v1-5/stable-diffusion-inpainting", 
        body: { inputs: { image: imgClean, mask: mskClean } } 
      }
    ];

    let response;
    let lastError = "No se pudieron realizar intentos.";
    let lastUrl = "";

    for (const config of configs) {
      try {
        lastUrl = config.url;
        console.log(`Intentando: ${lastUrl}`);
        response = await fetch(lastUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(config.body)
        });

        if (response.ok || response.status === 503) {
          break;
        }
        
        const errText = await response.text();
        lastError = `Status ${response.status}: ${errText}`;
        console.warn(`Fallo en ${lastUrl}: ${lastError}`);
      } catch (e) {
        lastError = e.message;
        console.error(`Error de red en ${lastUrl}:`, e);
      }
    }

    // Si después de todos los intentos no tenemos un response decente
    if (!response || (!response.ok && response.status !== 503)) {
      return res.status(response?.status || 500).json({ 
        error: "Fallo total de conexión con Hugging Face.",
        details: `Último intento en ${lastUrl} -> ${lastError}`
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
