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

    // Numerar las imágenes de referencia dinámicamente
    let imgIndex = 2; // imagen 1 = baño
    const refMap = {};
    if (toilet && toilet.imageUrl) { refMap.toilet = imgIndex++; }
    if (sink   && sink.imageUrl)   { refMap.sink   = imgIndex++; }
    if (floor  && floor.imageUrl)  { refMap.floor  = imgIndex++; }

    const replacements = [];
    if (toilet) replacements.push(`TOILET: Replace the existing toilet with the exact product shown in IMAGE ${refMap.toilet || ""}. Product: "${toilet.name}" — ${toilet.description || "modern white ceramic toilet"}.`);
    if (sink)   replacements.push(`SINK: Replace the existing sink/vanity with the exact product shown in IMAGE ${refMap.sink || ""}. Product: "${sink.name}" — ${sink.description || "modern white ceramic sink"}.`);
    if (floor)  replacements.push(`FLOOR: Replace ALL visible floor tiles with the exact pattern shown in IMAGE ${refMap.floor || ""}. Product: "${floor.name}" — ${floor.description || "modern floor tiles"}.`);

    const hasRefs = Object.keys(refMap).length > 0;

    const prompt = `You are a photorealistic bathroom renovation visualizer.

IMAGE 1 = the real bathroom to modify.
${hasRefs ? Object.entries(refMap).map(([k,i]) => `IMAGE ${i} = reference photo of the ${k} product to install.`).join("\n") : ""}

TASK: Produce a photorealistic modified version of IMAGE 1 with ONLY these changes:
${replacements.join("\n")}

STRICT RULES:
1. Camera angle, perspective and composition must be PIXEL-IDENTICAL to IMAGE 1. No zoom, crop or rotation.
2. Everything NOT listed (walls, ceiling, tiles, shower, window, mirror, fixtures, cabinet) must remain EXACTLY as in IMAGE 1.
3. Do NOT redecorate. Do NOT add or remove any objects.
4. Each replaced product must match the shape, color, finish and proportions of its reference image EXACTLY.
5. Replaced products must respect the scale and perspective of IMAGE 1.
6. Lighting and shadows on replaced products must match IMAGE 1's lighting conditions.
7. FLOOR rule: if replacing floor, cover 100% of visible floor area — no original tiles remaining.
8. Final output must look like a real photograph, not a render or 3D visualization.`;

    // Base64 del baño (solo este viaja en el body — los productos van como URL)
    const base64Data = baseImageDataUrl.includes(",")
      ? baseImageDataUrl.split(",")[1]
      : baseImageDataUrl;
    const mimeMatch = baseImageDataUrl.match(/data:(image\/\w+);base64/);
    const mimeType  = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // Construir content: baño en base64 + productos como URL pública
    const contentItems = [
      {
        type: "input_image",
        image_url: `data:${mimeType};base64,${base64Data}`
      }
    ];

    // Agregar imágenes de productos como URLs públicas (sin descargarlas)
    if (toilet && toilet.imageUrl && refMap.toilet) {
      contentItems.push({ type: "input_image", image_url: toilet.imageUrl });
    }
    if (sink && sink.imageUrl && refMap.sink) {
      contentItems.push({ type: "input_image", image_url: sink.imageUrl });
    }
    if (floor && floor.imageUrl && refMap.floor) {
      contentItems.push({ type: "input_image", image_url: floor.imageUrl });
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
