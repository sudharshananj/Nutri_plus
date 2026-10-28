import { api } from "./api.js";
import {
  escapeHtml,
  initMobileNav,
  initThemeToggle,
  openModal,
  setupModalDismiss,
  showToast
} from "./utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initMobileNav();
  setupModalDismiss("recipe-modal");

  const videoEl = document.getElementById("scanner-video");
  const virtualCanvas = document.getElementById("virtual-video-canvas");
  const canvasEl = document.getElementById("scanner-canvas");
  const startCameraBtn = document.getElementById("btn-start-camera");
  const virtualCamBtn = document.getElementById("btn-virtual-camera");
  const nativeCamBtn = document.getElementById("btn-native-camera");
  const nativeCamInput = document.getElementById("native-camera-input");
  const captureBtn = document.getElementById("btn-capture-scan");
  const stopCameraBtn = document.getElementById("btn-stop-camera");
  const fileInput = document.getElementById("food-image-input");
  const dropzone = document.getElementById("upload-dropzone");
  const resultCard = document.getElementById("scan-result-card");
  const statusBanner = document.getElementById("camera-status-banner");
  const hudEl = document.getElementById("scanner-hud");
  const placeholderEl = document.getElementById("camera-placeholder");

  let mediaStream = null;
  let isVirtualMode = false;
  let virtualAnimId = null;
  let lastScanResult = null;
  let activePortionMultiplier = 1.0;
  let virtualDishIndex = 0;

  const VIRTUAL_DISHES = [
    { name: "Vegetable Poha", color: "#facc15", garnish: "#16a34a", plate: "#f8fafc" },
    { name: "Fresh Green Salad Bowl", color: "#22c55e", garnish: "#ef4444", plate: "#e2e8f0" },
    { name: "Steamed Idli with Sambar", color: "#f8fafc", garnish: "#ea580c", plate: "#334155" },
    { name: "Grilled Lemon Herb Chicken", color: "#d97706", garnish: "#84cc16", plate: "#1e293b" },
    { name: "Fruit & Oatmeal Chia Bowl", color: "#f472b6", garnish: "#3b82f6", plate: "#f1f5f9" }
  ];

  // Check secure context
  checkCameraEnvironment();

  function checkCameraEnvironment() {
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      showStatusBanner(
        "⚠️ <strong>Browser Security Note:</strong> Hardware cameras require <code>http://localhost:5000</code> or HTTPS. If accessing via a local network IP address, browsers block physical webcams. You can use our <strong>Virtual Camera Feed</strong> or upload a photo below!",
        "warning"
      );
    }
  }

  function showStatusBanner(html, type = "info") {
    if (!statusBanner) return;
    statusBanner.style.display = "block";
    if (type === "warning") {
      statusBanner.style.background = "rgba(245, 158, 11, 0.12)";
      statusBanner.style.border = "1px solid rgba(245, 158, 11, 0.4)";
      statusBanner.style.color = "#fbbf24";
    } else if (type === "error") {
      statusBanner.style.background = "rgba(239, 68, 68, 0.12)";
      statusBanner.style.border = "1px solid rgba(239, 68, 68, 0.4)";
      statusBanner.style.color = "#f87171";
    } else {
      statusBanner.style.background = "rgba(56, 189, 248, 0.12)";
      statusBanner.style.border = "1px solid rgba(56, 189, 248, 0.4)";
      statusBanner.style.color = "#38bdf8";
    }
    statusBanner.innerHTML = html;
  }

  function hideStatusBanner() {
    if (statusBanner) statusBanner.style.display = "none";
  }

  // 1. Hardware Camera Controls with Multi-Stage Fallback
  if (startCameraBtn) {
    startCameraBtn.addEventListener("click", async () => {
      stopVirtualCamera();
      hideStatusBanner();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showStatusBanner(
          "⚠️ <strong>Hardware Camera API Unavailable:</strong> Your current browser or network context restricts direct camera hardware. Please open via <code>http://localhost:5000</code> or use our <strong>Virtual Camera Feed</strong> below.",
          "warning"
        );
        showToast("Camera API not available. Starting Virtual Camera...", "warning");
        startVirtualCamera();
        return;
      }

      try {
        let stream = null;

        // Stage 1: Try environment/rear camera (great for mobile)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } }
          });
        } catch (e1) {
          console.log("Ideal environment camera constraint failed, falling back to front camera", e1);
          // Stage 2: Try front user-facing camera (standard on desktop/laptops)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "user" }
            });
          } catch (e2) {
            console.log("User facing camera failed, falling back to basic video: true", e2);
            // Stage 3: Basic video: true without constraints
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }

        if (stream && videoEl) {
          mediaStream = stream;
          videoEl.srcObject = mediaStream;
          videoEl.style.display = "block";
          if (placeholderEl) placeholderEl.style.display = "none";
          if (virtualCanvas) virtualCanvas.style.display = "none";

          startCameraBtn.style.display = "none";
          if (virtualCamBtn) virtualCamBtn.style.display = "none";
          stopCameraBtn.style.display = "inline-flex";
          captureBtn.disabled = false;
          if (hudEl) {
            hudEl.style.display = "block";
            hudEl.textContent = "HARDWARE SENSOR • LIVE FEED • AF LOCKED";
          }
          showToast("Live webcam active.", "success");
        }
      } catch (err) {
        console.error("Camera access error:", err);
        let errorMsg = "Could not access hardware camera.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMsg = "Camera permission was denied. Please click the lock or camera icon in your browser URL bar to allow camera access.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMsg = "No webcam device was found on this system. You can use our Virtual Camera Feed or upload photos.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorMsg = "Your webcam is currently locked or in use by another application (e.g., Zoom, Teams). Please close it and retry.";
        } else if (err.name === "OverconstrainedError") {
          errorMsg = "Camera resolution/orientation constraints could not be satisfied.";
        }

        showStatusBanner(`⚠️ <strong>Camera Notice:</strong> ${escapeHtml(errorMsg)} <br><button id="btn-banner-virtual" class="btn btn-sm btn-primary" style="margin-top:0.6rem;">Launch Virtual Camera Feed</button>`, "warning");

        const bannerVirtualBtn = document.getElementById("btn-banner-virtual");
        if (bannerVirtualBtn) {
          bannerVirtualBtn.addEventListener("click", startVirtualCamera);
        }
      }
    });
  }

  // 2. Virtual Camera Feed (100% Reliable Simulation)
  if (virtualCamBtn) {
    virtualCamBtn.addEventListener("click", () => {
      startVirtualCamera();
    });
  }

  function startVirtualCamera() {
    stopHardwareCamera();
    isVirtualMode = true;
    if (placeholderEl) placeholderEl.style.display = "none";
    if (videoEl) videoEl.style.display = "none";
    if (virtualCanvas) {
      virtualCanvas.style.display = "block";
      virtualCanvas.width = 640;
      virtualCanvas.height = 480;
    }

    if (startCameraBtn) startCameraBtn.style.display = "none";
    if (virtualCamBtn) virtualCamBtn.style.display = "none";
    if (stopCameraBtn) stopCameraBtn.style.display = "inline-flex";
    captureBtn.disabled = false;

    if (hudEl) {
      hudEl.style.display = "block";
      hudEl.textContent = "SIMULATED SENSOR • ACTIVE VIEW • CLICK DISH TO CYCLE";
    }

    showToast("Virtual Camera Feed active. Click 'Capture & Scan Frame' to scan!", "info");

    runVirtualCameraLoop();
  }

  function runVirtualCameraLoop() {
    if (!virtualCanvas) return;
    const ctx = virtualCanvas.getContext("2d");
    let angle = 0;

    const renderVirtual = () => {
      if (!isVirtualMode) return;

      const w = virtualCanvas.width;
      const h = virtualCanvas.height;
      const dish = VIRTUAL_DISHES[virtualDishIndex % VIRTUAL_DISHES.length];

      // Clean background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);

      // Subtle table surface
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#1e293b");
      grad.addColorStop(1, "#0f172a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Target reticle / guidelines
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 170, 0, Math.PI * 2);
      ctx.stroke();

      // Plate
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle * 0.005);

      // Outer rim shadow
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, 140, 0, Math.PI * 2);
      ctx.fillStyle = dish.plate;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner plate rim
      ctx.beginPath();
      ctx.arc(0, 0, 115, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Food Portion / Texture
      ctx.beginPath();
      ctx.arc(0, 0, 95, 0, Math.PI * 2);
      ctx.fillStyle = dish.color;
      ctx.fill();

      // Garnish & Spices texture dots
      for (let i = 0; i < 18; i++) {
        const rad = (i * 37) % 80;
        const a = (i * 53) % 360;
        const gx = Math.cos(a) * rad;
        const gy = Math.sin(a) * rad;
        ctx.beginPath();
        ctx.arc(gx, gy, 4 + (i % 3), 0, Math.PI * 2);
        ctx.fillStyle = dish.garnish;
        ctx.fill();
      }

      ctx.restore();

      // Dish Label Overlay
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.fillRect(w / 2 - 130, h - 55, 260, 36);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.strokeRect(w / 2 - 130, h - 55, 260, 36);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Target: ${dish.name}`, w / 2, h - 32);

      angle++;
      virtualAnimId = requestAnimationFrame(renderVirtual);
    };

    if (virtualAnimId) cancelAnimationFrame(virtualAnimId);
    virtualAnimId = requestAnimationFrame(renderVirtual);
  }

  function stopVirtualCamera() {
    isVirtualMode = false;
    if (virtualAnimId) {
      cancelAnimationFrame(virtualAnimId);
      virtualAnimId = null;
    }
    if (virtualCanvas) virtualCanvas.style.display = "none";
  }

  function stopHardwareCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (videoEl) videoEl.style.display = "none";
  }

  if (stopCameraBtn) {
    stopCameraBtn.addEventListener("click", () => {
      stopHardwareCamera();
      stopVirtualCamera();
      if (placeholderEl) placeholderEl.style.display = "flex";
      if (startCameraBtn) startCameraBtn.style.display = "inline-flex";
      if (virtualCamBtn) virtualCamBtn.style.display = "inline-flex";
      stopCameraBtn.style.display = "none";
      captureBtn.disabled = true;
      if (hudEl) hudEl.style.display = "none";
      hideStatusBanner();
    });
  }

  // Allow clicking on virtual canvas to cycle sample dishes
  if (virtualCanvas) {
    virtualCanvas.addEventListener("click", () => {
      if (isVirtualMode) {
        virtualDishIndex = (virtualDishIndex + 1) % VIRTUAL_DISHES.length;
        showToast(`Virtual Camera switched to: ${VIRTUAL_DISHES[virtualDishIndex].name}`, "info");
      }
    });
  }

  // 3. Native Phone Camera Input Trigger
  if (nativeCamBtn && nativeCamInput) {
    nativeCamBtn.addEventListener("click", () => {
      nativeCamInput.click();
    });

    nativeCamInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0]);
      }
    });
  }

  // 4. Capture and Scan Frame
  if (captureBtn) {
    captureBtn.addEventListener("click", () => {
      if (isVirtualMode && virtualCanvas) {
        const base64Data = virtualCanvas.toDataURL("image/jpeg", 0.85);
        const currentDish = VIRTUAL_DISHES[virtualDishIndex % VIRTUAL_DISHES.length];
        processScanPayload({
          image_base64: base64Data,
          client_hint: currentDish.name
        });
      } else if (videoEl && canvasEl) {
        const ctx = canvasEl.getContext("2d");
        canvasEl.width = videoEl.videoWidth || 640;
        canvasEl.height = videoEl.videoHeight || 480;
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        const base64Data = canvasEl.toDataURL("image/jpeg", 0.85);

        processScanPayload({ image_base64: base64Data });
      }
    });
  }

  // 5. File Upload & Drag-and-Drop
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0]);
      }
    });
  }

  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });
    dropzone.addEventListener("click", () => {
      if (fileInput) fileInput.click();
    });
  }

  function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      processScanPayload({
        image_base64: e.target.result,
        client_hint: file.name
      });
    };
    reader.readAsDataURL(file);
  }

  // 6. Quick Sample Presets (for reviewers to test instantly)
  document.querySelectorAll(".btn-preset-test").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hint = btn.dataset.hint;
      processScanPayload({ client_hint: hint });
    });
  });

  // 7. Send to Food Scanner Backend
  async function processScanPayload(payload) {
    if (resultCard) {
      resultCard.style.display = "block";
      resultCard.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem;">
          <div class="skeleton" style="height: 36px; width: 60%; margin: 0 auto 1.5rem;"></div>
          <div class="skeleton" style="height: 120px; width: 100%; margin: 0 auto 1.5rem;"></div>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            Analyzing visual features, color spectrum, and nutritional references...
          </p>
        </div>
      `;
      resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      const result = await api.scanFood(payload);
      lastScanResult = result;
      activePortionMultiplier = 1.0;
      renderScanResult(result);
    } catch (err) {
      showToast(err.message || "Failed to analyze food image.", "error");
      if (resultCard) {
        resultCard.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <p style="color: var(--danger); font-weight: 600;">Recognition could not complete.</p>
            <p style="color: var(--text-muted); font-size: 0.88rem;">${escapeHtml(err.message)}</p>
          </div>
        `;
      }
    }
  }

  function renderScanResult(data) {
    if (!resultCard) return;

    const nut = data.nutrition_estimate || {};
    const cals = Math.round((nut.calories || 0) * activePortionMultiplier);
    const protein = ((nut.protein_g || 0) * activePortionMultiplier).toFixed(1);
    const carbs = ((nut.carbs_g || 0) * activePortionMultiplier).toFixed(1);
    const fat = ((nut.fat_g || 0) * activePortionMultiplier).toFixed(1);
    const fiber = ((nut.fiber_g || 0) * activePortionMultiplier).toFixed(1);

    const recipeAvailable = data.catalog_recipe;

    resultCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
        <div>
          <span class="badge badge-success" style="margin-bottom: 0.4rem;">
            ✓ ${escapeHtml(data.confidence_score)} Match Confidence
          </span>
          <h3 style="font-size: 1.6rem; font-weight: 800; line-height: 1.2;">
            ${escapeHtml(data.detected_food)}
          </h3>
          <span style="font-size: 0.85rem; color: var(--text-muted);">
            Serving: ${escapeHtml(data.serving_size)}
          </span>
        </div>
        <div style="background: var(--primary-light); padding: 0.6rem 1.2rem; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 2rem; font-weight: 900; color: var(--primary); line-height: 1;">
            ${cals}
          </div>
          <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--primary);">
            Estimated kcal
          </div>
        </div>
      </div>

      <!-- Portion Size Selector -->
      <div style="margin-bottom: 1.5rem; background: var(--bg-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-md);">
        <label style="display: block; font-weight: 600; font-size: 0.88rem; margin-bottom: 0.5rem;">
          Adjust Portion Size:
        </label>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-sm portion-btn ${activePortionMultiplier === 0.75 ? "btn-primary" : "btn-secondary"}" data-mult="0.75">
            Small (0.75x)
          </button>
          <button class="btn btn-sm portion-btn ${activePortionMultiplier === 1.0 ? "btn-primary" : "btn-secondary"}" data-mult="1.0">
            Medium Standard (1.0x)
          </button>
          <button class="btn btn-sm portion-btn ${activePortionMultiplier === 1.5 ? "btn-primary" : "btn-secondary"}" data-mult="1.5">
            Large (1.5x)
          </button>
        </div>
      </div>

      <!-- Macronutrients Bar -->
      <div class="macro-grid">
        <div class="macro-box">
          <div class="macro-val">${protein}g</div>
          <div class="macro-lbl">Protein</div>
        </div>
        <div class="macro-box">
          <div class="macro-val">${carbs}g</div>
          <div class="macro-lbl">Carbs</div>
        </div>
        <div class="macro-box">
          <div class="macro-val">${fat}g</div>
          <div class="macro-lbl">Fats</div>
        </div>
        <div class="macro-box">
          <div class="macro-val">${fiber}g</div>
          <div class="macro-lbl">Fiber</div>
        </div>
      </div>

      <!-- Health Tip & Note -->
      <div style="background: var(--bg-subtle); border-left: 3px solid var(--accent); padding: 0.75rem 1rem; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-size: 0.88rem; margin-bottom: 1.25rem;">
        <strong>Nutritional Highlight:</strong> ${escapeHtml(data.health_tip)}
      </div>

      ${
        recipeAvailable
          ? `<div style="margin-top: 1.25rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button class="btn btn-outline btn-sm" id="btn-scanner-view-recipe">
                📖 View Healthy Recipe & Cooking Steps
              </button>
            </div>`
          : ""
      }

      <div style="margin-top: 1.25rem; font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 0.75rem;">
        ${escapeHtml(data.disclaimer)}
      </div>
    `;

    // Bind portion buttons
    document.querySelectorAll(".portion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activePortionMultiplier = parseFloat(btn.dataset.mult);
        renderScanResult(lastScanResult);
      });
    });

    // Bind recipe view
    const viewRecipeBtn = document.getElementById("btn-scanner-view-recipe");
    if (viewRecipeBtn && recipeAvailable) {
      viewRecipeBtn.addEventListener("click", () => {
        renderRecipeModal(data.catalog_recipe);
        openModal("recipe-modal");
      });
    }
  }

  function renderRecipeModal(recipe) {
    const title = document.getElementById("modal-recipe-title");
    const body = document.getElementById("modal-recipe-body");
    if (!title || !body) return;

    title.textContent = recipe.name;
    const ingredients = recipe.ingredients || [];
    const steps = recipe.recipe_steps || [];

    body.innerHTML = `
      <div style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.88rem;">
        Prep: ${recipe.prep_time_min} mins | Cook: ${recipe.cook_time_min || 10} mins
      </div>
      <h4 class="recipe-section-title">Ingredients Checklist:</h4>
      <ul class="ingredient-checklist">
        ${ingredients.map((ing) => `
          <li class="ingredient-item">
            <label style="cursor: pointer; display: flex; align-items: center; gap: 0.6rem;">
              <input type="checkbox">
              <span>${escapeHtml(ing)}</span>
            </label>
          </li>
        `).join("")}
      </ul>
      <h4 class="recipe-section-title">Step-by-Step Directions:</h4>
      <ol class="recipe-steps-list">
        ${steps.map((st) => `<li>${escapeHtml(st)}</li>`).join("")}
      </ol>
    `;
  }
});
