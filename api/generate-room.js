export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { baseImageDataUrl, selectedProducts } = req.body;

    if (!baseImageDataUrl) return res.status(400).json({ error: "No base image provided" });
    if (!selectedProducts || selectedProducts.length === 0) return res.status(400).json({ error: "No products selected" });

    const sink   = selectedProducts.find(p => p.type === "sink");
    const toilet = selectedProducts.find(p => p.type === "toilet");
    const floor  = selectedProducts.find(p => p.type === "floor");

    // Descargar imágenes de productos y convertir a base64
    async function fetchImageAsBase64(url) {
      try {
        const r = await fetch(url);
        const buffer = await r.arrayBuffer();
        const b64 = Buffer.from(buffer).toString("base64");
        const ct = r.headers.get("content-type") || "image/jpeg";
        return { b64, mime: ct.split(";")[0] };
      } catch (e) {
        return null;
      }
    }

    const sinkImg   = sink   && sink.imageUrl   ? await fetchImageAsBase64(sink.imageUrl)   : null;
    const toiletImg = toilet && toilet.imageUrl ? await fetchImageAsBase64(toilet.imageUrl) : null;
    const floorImg  = floor  && floor.imageUrl  ? await fetchImageAsBase64(floor.imageUrl)  : null;

    // Construir prompt
    const replacements = [];
    if (toilet) replacements.push(`TOILET: Replace the existing toilet with the exact model shown in the REFERENCE IMAGE ${toiletImg ? "2" : ""}. Product name: "${toilet.name}". Style: ${toilet.description || "modern white ceramic toilet"}.`);
    if (sink)   replacements.push(`SINK: Replace the existing sink/vanity with the exact model shown in the REFERENCE IMAGE ${sinkImg ? (toiletImg ? "3" : "2") : ""}. Product name: "${sink.name}". Style: ${sink.description || "modern white ceramic sink"}.`);
    if (floor)  replacements.push(`FLOOR: Replace ALL visible floor tiles with the exact pattern shown in the REFERENCE IMAGE ${floorImg ? (toiletImg && sinkImg ? "4" : toiletImg || sinkImg ? "3" : "2") : ""}. Product name: "${floor.name}". Style: ${floor.description || "modern floor tiles"}.`);

    const hasRefs = sinkImg || toiletImg || floorImg;

    const prompt = `You are a photorealistic bathroom renovation visualizer.

IMAGE 1 is the REAL BATHROOM PHOTO that must be modified.
${hasRefs ? "The following images are PRODUCT REFERENCE PHOTOS showing exactly what each replacement must look like." : ""}

YOUR TASK: Generate a photorealistic version of IMAGE 1 with ONLY these replacements:
${replacements.join("\n")}

STRICT RULES — follow every single one:
1. The camera angle, perspective, and composition must be IDENTICAL to IMAGE 1. Do not zoom, crop, or rotate.
2. ALL walls, ceiling, tiles, shower, windows, doors, mirrors, and fixtures NOT listed above must remain EXACTLY as they are.
3. Do NOT redecorate. Do NOT add objects. Do NOT change wall colors or layouts.
4. Each replaced product must EXACTLY match the shape, color, finish, and proportions of its reference photo.
5. The replaced products must respect the scale and perspective of the original bathroom.
6. Lighting and shadows on replaced products must match the room's lighting in IMAGE 1.
7. The final image must look like a REAL PHOTOGRAPH — not a render, not a 3D model, not a composite.
8. FLOOR: If floor is being replaced, every single visible floor tile must be replaced. No original tiles should remain.

Produce the modified bathroom image now.`;

    // Extraer base64 del baño
    const base64Data = baseImageDataUrl.includes(",")
      ? baseImageDataUrl.split(",")[1]
      : baseImageDataUrl;
    const mimeMatch = baseImageDataUrl.match(/data:(image\/\w+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // Construir array de imágenes: baño primero, luego referencias de productos
    const contentItems = [
      {
        type: "input_image",
        image_url: `data:${mimeType};base64,${base64Data}`
      }
    ];

    if (toiletImg) {
      contentItems.push({ type: "input_image", image_url: `data:${toiletImg.mime};base64,${toiletImg.b64}` });
    }
    if (sinkImg) {
      contentItems.push({ type: "input_image", image_url: `data:${sinkImg.mime};base64,${sinkImg.b64}` });
    }
    if (floorImg) {
      contentItems.push({ type: "input_image", image_url: `data:${floorImg.mime};base64,${floorImg.b64}` });
    }

    contentItems.push({ type: "input_text", text: prompt });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        input: [{ role: "user", content: contentItems }],
        tools: [{
          type: "image_generation",
          quality: "high",
          size: "1024x1024",
          output_format: "png"
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data?.error?.message || "OpenAI error", raw: data });
    }

    const imageBlock = data?.output?.find(item => item.type === "image_generation_call");
    const imageBase64 = imageBlock?.result;

    if (!imageBase64) {
      console.error("No image in response:", JSON.stringify(data?.output));
      return res.status(500).json({ error: "No image returned from OpenAI", raw: data });
    }

    return res.status(200).json({ image: `data:image/png;base64,${imageBase64}` });

  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ error: error.message });
  }
}
