export default async function handler(req, res) {
  // CORS (IMPORTANTE para GHL)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { roomType, baseImageDataUrl, selectedProducts } = req.body;

    if (!baseImageDataUrl) {
      return res.status(400).json({ error: "No base image provided" });
    }

    // 🔥 Construcción del prompt inteligente
    const sink = selectedProducts.find(p => p.type === "sink");
    const toilet = selectedProducts.find(p => p.type === "toilet");
    const floor = selectedProducts.find(p => p.type === "floor");

    const prompt = `
You are a professional interior designer AI.

Task:
Modify the provided bathroom image realistically.

Rules:
- Keep the original layout, walls, lighting, and proportions.
- DO NOT redesign the entire bathroom.
- ONLY replace these elements:

Sink: ${sink?.name || "keep original"}
Toilet: ${toilet?.name || "keep original"}
Floor: ${floor?.name || "keep original"}

Style:
- ultra realistic
- natural lighting
- correct perspective
- professional interior design rendering
- no distortion

Important:
- The final image must look like a real photograph, not a 3D render.
- Maintain shadows and reflections.
`;

    // 🔥 llamada a OpenAI
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        size: "1024x1024"
      })
    });

    const data = await response.json();

    if (!response.ok) {
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
    return res.status(500).json({
      error: error.message
    });
  }
}
