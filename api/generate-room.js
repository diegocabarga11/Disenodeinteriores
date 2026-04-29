export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { selectedProducts } = req.body;

    if (!selectedProducts || selectedProducts.length === 0) {
      return res.status(400).json({ error: "No products selected" });
    }

    const sink   = selectedProducts.find(p => p.type === "sink");
    const toilet = selectedProducts.find(p => p.type === "toilet");
    const floor  = selectedProducts.find(p => p.type === "floor");

    const parts = [];
    if (toilet) parts.push(`a ${toilet.name} toilet (${toilet.description})`);
    if (sink)   parts.push(`a ${sink.name} sink (${sink.description})`);
    if (floor)  parts.push(`${floor.name} floor tiles (${floor.description})`);

    const prompt = `A photorealistic modern bathroom interior with ${parts.join(", ")}. 
Natural lighting, ultra realistic photograph, professional interior design, 
high resolution, no people, clean and elegant style.`;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1024x1024"
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
      return res.status(500).json({ error: "No image returned", raw: data });
    }

    return res.status(200).json({
      image: `data:image/png;base64,${imageBase64}`
    });

  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ error: error.message });
  }
}
