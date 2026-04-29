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

    const replacements = [];
    if (toilet) replacements.push(`- Replace the toilet with: ${toilet.name}, ${toilet.description}, modern white ceramic, clean design`);
    if (sink)   replacements.push(`- Replace the sink with: ${sink.name}, ${sink.description}, modern white ceramic`);
    if (floor)  replacements.push(`- Replace the floor tiles with: ${floor.name}, ${floor.description}`);

    const prompt = `You are a photorealistic bathroom renovation visualizer.

Look at this bathroom photo carefully. Generate a new version with ONLY these changes:
${replacements.join("\n")}

RULES:
- Keep ALL walls, ceiling, shower, doors, windows, lighting and camera angle EXACTLY the same.
- Keep all colors and finishes of everything not listed above.
- New elements must match the room perspective and lighting naturally.
- Result must look like a real photo, not a render.
- Do NOT redesign or add anything extra.`;

    const base64Data = baseImageDataUrl.includes(",")
      ? baseImageDataUrl.split(",")[1]
      : baseImageDataUrl;

    const mimeMatch = baseImageDataUrl.match(/data:(image\/\w+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    const imageBuffer = Buffer.from(base64Data, "base64");

    const textField = (name, value) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;

    const fileField = (name, filename, contentType, buffer) => {
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
      return Buffer.concat([Buffer.from(header), buffer, Buffer.from("\r\n")]);
    };

    const parts = [
      Buffer.from(textField("model", "gpt-image-1")),
      Buffer.from(textField("prompt", prompt)),
      Buffer.from(textField("n", "1")),
      Buffer.from(textField("size", "1024x1024")),
      fileField("image", "room.png", mimeType, imageBuffer),
      Buffer.from(`--${boundary}--\r\n`),
    ];

    const body = Buffer.concat(parts);

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
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
