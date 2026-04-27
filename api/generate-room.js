import FormData from "form-data";

// Descripciones técnicas por producto - agregar aquí los del catálogo real
const PRODUCT_DESCRIPTIONS = {
  // POCETAS
  "toilet": {
    default: "a modern two-piece elongated toilet, glossy white ceramic, standard height, clean design"
  },
  // LAVAMANOS
  "sink": {
    default: "a modern white ceramic sink, clean lines, wall-mounted or vanity-style"
  },
  // PISOS
  "floor": {
    default: "modern floor tiles, clean and contemporary finish"
  }
};

function buildPrompt(sink, toilet, floor) {
  const sinkDesc = sink?.description || (sink ? PRODUCT_DESCRIPTIONS.sink.default : null);
  const toiletDesc = toilet?.description || (toilet ? PRODUCT_DESCRIPTIONS.toilet.default : null);
  const floorDesc = floor?.description || (floor ? PRODUCT_DESCRIPTIONS.floor.default : null);

  const replacements = [];
  if (toiletDesc) replacements.push(`- Replace the existing toilet with: ${toiletDesc}`);
  if (sinkDesc) replacements.push(`- Replace the existing sink/washbasin with: ${sinkDesc}`);
  if (floorDesc) replacements.push(`- Replace the existing floor with: ${floorDesc}`);

  // Si no hay nada seleccionado, devolver null
  if (replacements.length === 0) return null;

  return `You are a photorealistic interior visualization tool.

STRICT RULES - follow exactly:
1. Keep the ENTIRE room structure identical: walls, ceiling, window, door positions, lighting conditions, camera angle, perspective.
2. Keep all personal items, towels, decorations exactly as they are.
3. Do NOT redecorate. Do NOT redesign. Do NOT add elements that are not there.
4. ONLY make these specific replacements:
${replacements.join("\n")}

After replacement:
- The new elements must match the room's perspective, scale, and lighting naturally.
- Shadows and reflections must look physically correct.
- The final result must look like a real photograph taken in this exact room after installation.
- Do NOT make it look like a 3D render or a catalog photo.

The customer needs to visualize their real space with the new product. Realism is critical.`;
}

function base64ToBuffer(dataUrl) {
  // Acepta "data:image/png;base64,XXX" o solo el base64 crudo
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return Buffer.from(base64, "base64");
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { roomType, baseImageDataUrl, selectedProducts } = req.body;

    if (!baseImageDataUrl) {
      return res.status(400).json({ error: "No base image provided" });
    }
    if (!selectedProducts || selectedProducts.length === 0) {
      return res.status(400).json({ error: "No products selected" });
    }

    // Extraer productos seleccionados
    const sink    = selectedProducts.find(p => p.type === "sink");
    const toilet  = selectedProducts.find(p => p.type === "toilet");
    const floor   = selectedProducts.find(p => p.type === "floor");

    // Construir prompt
    const prompt = buildPrompt(sink, toilet, floor);
    if (!prompt) {
      return res.status(400).json({ error: "No valid products to replace" });
    }

    // Convertir imagen base64 → Buffer
    const imageBuffer = base64ToBuffer(baseImageDataUrl);

    // Construir FormData multipart (requerido por images/edits)
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("n", "1");
    form.append("size", "1024x1024");
    // Imagen del baño real del cliente
    form.append("image", imageBuffer, {
      filename: "room.png",
      contentType: "image/png"
    });

    // Llamada a images/edits (NO images/generations)
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI error",
        raw: data
      });
    }

    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) {
      return res.status(500).json({
        error: "No image returned from OpenAI",
        raw: data
      });
    }

    return res.status(200).json({
      image: `data:image/png;base64,${imageBase64}`
    });

  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ error: error.message });
  }
}
