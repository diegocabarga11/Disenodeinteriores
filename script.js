async function generar() {
  try {
    const prompt = "A modern bathroom with a luxury sink and elegant floor design";

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt
      })
    });

    const data = await response.json();

    console.log(data);

    if (data.image) {
      const img = document.createElement("img");
      img.src = data.image;
      img.style.width = "400px";
      document.body.appendChild(img);
    } else {
      alert("No se generó imagen");
    }

  } catch (error) {
    console.error(error);
    alert("Error generando imagen");
  }
}
