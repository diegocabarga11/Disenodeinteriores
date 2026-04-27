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
    const { baseImageDataUrl, selectedProducts } = req.body;

    if (!baseImageDataUrl) {
      return res.status(400).json({ error: "No base image provided" });
    }
    if (!selectedProducts || selectedProducts.length === 0) {
      return res.status(400).json({ error: "No products selected" });
    }

    // Extraer productos seleccionados
    const sink   = selectedProducts.find(p => p.type === "sink");
    const toilet = selectedProducts.find(p => p.type === "toilet");
    const floor  = selectedProducts.find(p => p.type === "floor");

    // Construir lista de reemplazos
    const replacements = [];
    if (toilet) replacements.push(`- Replace the existing toilet with: ${toilet.description || toilet.name + ", modern white ceramic toilet, clean design"}`);
    if (sink)   replacements.push(`- Replace the existing sink with: ${sink.description || sink.name + ", modern white ceramic sink, clean design"}`);
    if (floor)  replacements.push(`- Replace the existing floor with: ${floor.description || floor.name + ", modern floor tiles"}`);

    const prompt = `You are a photorealistic interior visualization tool.

STRICT RULES - follow exactly:
1. Keep the ENTIRE room structure identical: walls, ceiling, windows, doors, lighting, camera angle, perspective.
2. Keep all personal items, towels, and decorations exactly as they appear.
3. Do NOT redecorate. Do NOT redesign. Do NOT add elements that are not there.
4. ONLY make these specific replacements:
${replacements.join("\n")}

After replacement:
- New elements must match the room's perspective, scale, and lighting naturally.
- Shadows and reflections must look physically correct.
- The final result must look like a real photograph taken in this exact room after installation.
- Do NOT make it look like a 3D render or catalog photo.`;

    // Extraer solo el base64 puro (sin el prefijo data:image/...;base64,)
    const base64Image = baseImageDataUrl.includes(",")
      ? baseImageDataUrl.split(",")[1]
      : baseImageDataUrl;

    // Llamada a OpenAI images/edits con imagen en base64
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        images: [{ type: "base64", media_type: "image/png", data: base64Image }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", JSON.stringify(data));
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
