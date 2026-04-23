async function generar() {
  try {
    const prompt = "A modern bathroom with a luxury sink and elegant floor design";

    const loadingMessage = document.getElementById("loadingMessage");
    const resultContainer = document.getElementById("resultContainer");

    if (loadingMessage) {
      loadingMessage.style.display = "block";
      loadingMessage.textContent = "Generando propuesta...";
    }

    if (resultContainer) {
      resultContainer.innerHTML = "";
    }

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    console.log("Respuesta del backend:", data);

    if (loadingMessage) {
      loadingMessage.style.display = "none";
    }

    if (data.image && resultContainer) {
      const img = document.createElement("img");
      img.src = data.image;
      img.alt = "Resultado generado por IA";
      img.style.width = "100%";
      img.style.maxWidth = "700px";
      img.style.display = "block";
      img.style.margin = "20px auto";
      img.style.borderRadius = "12px";
      img.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";

      resultContainer.innerHTML = "";
      resultContainer.appendChild(img);
    } else if (resultContainer) {
      resultContainer.innerHTML = `<p>${data.error || "No se generó imagen"}</p>`;
    }

  } catch (error) {
    console.error("Error generando imagen:", error);

    const loadingMessage = document.getElementById("loadingMessage");
    const resultContainer = document.getElementById("resultContainer");

    if (loadingMessage) {
      loadingMessage.style.display = "none";
    }

    if (resultContainer) {
      resultContainer.innerHTML = "<p>Error generando imagen.</p>";
    }
  }
}
