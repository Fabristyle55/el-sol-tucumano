// Comprime una imagen en el navegador antes de subirla (lado mayor 1000 px, JPEG).
// Así cada foto pesa unos 100-250 KB y no hace falta un plan pago de almacenamiento.
export async function comprimirImagen(archivo, max = 1000, calidad = 0.82) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const esc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * esc);
    c.height = Math.round(img.naturalHeight * esc);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Arma la dirección de una imagen generada con IA (Pollinations, gratuito y sin clave). */
export function urlImagenIA(nombre, semilla) {
  const prompt = `Professional food photography of "${nombre}", a product from an Argentine family bakery, `
    + 'freshly baked, on a rustic wooden table, soft natural window light, warm tones, shallow depth of field, appetizing, high detail, no text';
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=600&nologo=true&seed=${semilla}`;
}
