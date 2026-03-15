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
    let apiUrl = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-inpainting";

    const fetchOptions = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json"
      },
      // Limpiamos los Base64 de sus encabezados HTTP si los traen
      body: JSON.stringify({
        inputs: original.includes(',') ? original.split(',')[1] : original,
        mask: mask.includes(',') ? mask.split(',')[1] : mask,
        parameters: "high quality, remove object, clean background"
      })
    };

    let response = await fetch(apiUrl, fetchOptions);

    // Fallback al modelo de Stability AI
    if (response.status === 404) {
      apiUrl = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-inpainting";
      response = await fetch(apiUrl, fetchOptions);
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
