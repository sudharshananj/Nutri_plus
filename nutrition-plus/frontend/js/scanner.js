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
  const canvasEl = document.getElementById("scanner-canvas");
  const startCameraBtn = document.getElementById("btn-start-camera");
  const captureBtn = document.getElementById("btn-capture-scan");
  const stopCameraBtn = document.getElementById("btn-stop-camera");
  const fileInput = document.getElementById("food-image-input");
  const dropzone = document.getElementById("upload-dropzone");
  const resultCard = document.getElementById("scan-result-card");

  let mediaStream = null;
  let lastScanResult = null;
  let activePortionMultiplier = 1.0;

  // 1. Camera Controls
  if (startCameraBtn) {
    startCameraBtn.addEventListener("click", async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (videoEl) {
          videoEl.srcObject = mediaStream;
          videoEl.style.display = "block";
          document.getElementById("camera-placeholder").style.display = "none";
          startCameraBtn.style.display = "none";
          stopCameraBtn.style.display = "inline-flex";
          captureBtn.disabled = false;
        }
        showToast("Live camera viewfinder active.", "info");
      } catch (err) {
        showToast("Camera access unavailable. You can upload an image or click a sample preset.", "warning");
        console.warn("Camera init error:", err);
      }
    });
  }

  if (stopCameraBtn) {
    stopCameraBtn.addEventListener("click", stopCamera);
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (videoEl) videoEl.style.display = "none";
    document.getElementById("camera-placeholder").style.display = "flex";
    if (startCameraBtn) startCameraBtn.style.display = "inline-flex";
    if (stopCameraBtn) stopCameraBtn.style.display = "none";
    if (captureBtn) captureBtn.disabled = true;
  }

  // 2. Capture and Scan from Camera
  if (captureBtn) {
    captureBtn.addEventListener("click", () => {
      if (!videoEl || !canvasEl) return;
      const ctx = canvasEl.getContext("2d");
      canvasEl.width = videoEl.videoWidth || 640;
      canvasEl.height = videoEl.videoHeight || 480;
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const base64Data = canvasEl.toDataURL("image/jpeg", 0.85);

      processScanPayload({ image_base64: base64Data });
    });
  }

  // 3. File Upload & Drag-and-Drop
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

  // 4. Quick Sample Presets (for reviewers to test instantly)
  document.querySelectorAll(".btn-preset-test").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hint = btn.dataset.hint;
      processScanPayload({ client_hint: hint });
    });
  });

  // 5. Send to Food Scanner Backend
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
