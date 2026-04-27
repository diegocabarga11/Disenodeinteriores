export default async function handler(req, res) {
  // CORS
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

    const replacements = [];
    if (toilet) replacements.push(`TOILET: Replace the existing toilet with "${toilet.name}" — ${toilet.description || "modern white ceramic toilet, clean design, standard height"}`);
    if (sink)   replacements.push(`SINK: Replace the existing sink/vanity with "${sink.name}" — ${sink.description || "modern white ceramic sink, clean lines"}`);
    if (floor)  replacements.push(`FLOOR: Replace ALL floor tiles completely with "${floor.name}" — ${floor.description || "modern floor tiles, uniform pattern covering the entire floor area"}`);

    const prompt = `You are an expert photorealistic bathroom renovation visualizer.

I am going to show you a real bathroom photo. Your task is to generate a new version of this EXACT bathroom with specific product replacements.

MANDATORY RULES:
1. Keep 100% of the room structure: walls, ceiling, shower, doors, windows, mirrors, lighting fixtures, camera angle and perspective — ALL unchanged.
2. Keep all colors, textures and finishes of everything NOT listed below — unchanged.
3. Make ONLY these replacements:

${replacements.join("\n")}

CRITICAL FOR FLOOR REPLACEMENT:
- The floor replacement is MANDATORY. You MUST change every visible floor tile in the image.
- The new floor must cover the complete floor surface, including corners and edges.
- Match the perspective and light reflections of the original photo.
- Do not leave any original floor tiles visible.

QUALITY REQUIREMENTS:
- The result must look like a real photograph, NOT a render or illustration.
- Lighting, shadows and reflections must be physically coherent with the original photo.
- The new products must look naturally installed, not pasted on.

Generate the modified bathroom image now.`;

    // Extraer base64 puro
    const base64Data = baseImageDataUrl.includes(",")
      ? baseImageDataUrl.split(",")[1]
      : baseImageDataUrl;

    const mimeMatch = baseImageDataUrl.match(/data:(image\/\w+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // Responses API — formato correcto: input_image con url como data URL
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${base64Data}`
              },
              {
                type: "input_text",
                text: prompt
              }
            ]
          }
        ],
        tools: [
          {
            type: "image_generation",
            quality: "medium",
            size: "1024x1024",
            output_format: "png"
          }
        ]
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

    // Extraer imagen generada del output
    const imageBlock = data?.output?.find(item => item.type === "image_generation_call");
    const imageBase64 = imageBlock?.result;

    if (!imageBase64) {
      console.error("No image in response:", JSON.stringify(data?.output));
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
