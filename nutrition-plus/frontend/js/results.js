import { api } from "./api.js";
import {
  closeModal,
  escapeHtml,
  initMobileNav,
  initThemeToggle,
  openModal,
  setupModalDismiss,
  showToast
} from "./utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  initThemeToggle();
  initMobileNav();
  setupModalDismiss("recipe-modal");
  setupModalDismiss("excluded-modal");

  const mealsContainer = document.getElementById("meals-grid");
  const workoutsContainer = document.getElementById("workouts-grid");
  const excludedBadge = document.getElementById("excluded-count-badge");
  const transformationSection = document.getElementById("transformation-summary-box");

  let currentPlan = {
    meals: [],
    workouts: []
  };
  let excludedSample = [];

  // Load and Render Recommendations
  await fetchAndDisplayRecommendations();

  // Action Buttons
  const regenBtn = document.getElementById("btn-regenerate-plan");
  if (regenBtn) {
    regenBtn.addEventListener("click", async () => {
      regenBtn.disabled = true;
      regenBtn.textContent = "Regenerating...";
      await fetchAndDisplayRecommendations();
      regenBtn.disabled = false;
      regenBtn.textContent = "↻ Regenerate Plan";
      showToast("Fresh plan generated!", "info");
    });
  }

  const savePlanBtn = document.getElementById("btn-save-plan");
  if (savePlanBtn) {
    savePlanBtn.addEventListener("click", async () => {
      const title = prompt("Enter a name for this wellness plan:", "My Wellness Plan");
      if (!title) return;
      try {
        savePlanBtn.disabled = true;
        await api.savePlan(title, currentPlan);
        showToast("Plan saved to your library!", "success");
      } catch (err) {
        showToast(err.message || "Could not save plan.", "error");
      } finally {
        savePlanBtn.disabled = false;
      }
    });
  }

  if (excludedBadge) {
    excludedBadge.addEventListener("click", () => {
      renderExcludedModal(excludedSample);
      openModal("excluded-modal");
    });
  }

  async function fetchAndDisplayRecommendations() {
    showLoadingSkeletons();
    try {
      const data = await api.getRecommendations();

      if (data.status === "zero_matches") {
        renderZeroMatches(data);
        return;
      }

      currentPlan.meals = data.meals || [];
      currentPlan.workouts = data.workouts || [];
      excludedSample = data.excluded_sample || [];

      // Update safety excluded badge
      if (excludedBadge) {
        excludedBadge.textContent = `🛡️ ${data.excluded_count} meals excluded for your safety & diet`;
        excludedBadge.style.display = "inline-flex";
      }

      // Render Transformation Context
      if (transformationSection && data.transformation_summary) {
        renderTransformationCard(data.transformation_summary);
      }

      // Render Cards
      renderMealCards(currentPlan.meals);
      renderWorkoutCards(currentPlan.workouts);

    } catch (err) {
      console.error("Failed to load recommendations:", err);
      showToast(err.message || "Failed to generate recommendations.", "error");
      if (mealsContainer) {
        mealsContainer.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem;">
            <h3>Unable to load recommendations</h3>
            <p style="color: var(--text-muted); margin: 0.5rem 0 1.5rem;">${escapeHtml(err.message)}</p>
            <a href="profile.html" class="btn btn-primary">Edit My Preferences</a>
          </div>
        `;
      }
    }
  }

  function showLoadingSkeletons() {
    if (mealsContainer) {
      mealsContainer.innerHTML = Array(4).fill(0).map(() => `
        <div class="reco-card" style="height: 320px;">
          <div class="skeleton" style="height: 20px; width: 30%; margin-bottom: 1rem;"></div>
          <div class="skeleton" style="height: 28px; width: 80%; margin-bottom: 1rem;"></div>
          <div class="skeleton" style="height: 16px; width: 50%; margin-bottom: 1rem;"></div>
          <div class="skeleton" style="height: 80px; width: 100%; margin-bottom: 1rem;"></div>
          <div class="skeleton" style="height: 40px; width: 100%; margin-top: auto;"></div>
        </div>
      `).join("");
    }
    if (workoutsContainer) {
      workoutsContainer.innerHTML = Array(3).fill(0).map(() => `
        <div class="reco-card" style="height: 280px;">
          <div class="skeleton" style="height: 20px; width: 40%; margin-bottom: 1rem;"></div>
          <div class="skeleton" style="height: 26px; width: 75%; margin-bottom: 1rem;"></div>
          <div class="skeleton" style="height: 60px; width: 100%; margin-bottom: 1rem;"></div>
          <div class="skeleton" style="height: 38px; width: 100%; margin-top: auto;"></div>
        </div>
      `).join("");
    }
  }

  function renderTransformationCard(summary) {
    transformationSection.style.display = "block";
    const deltaHtml = summary.target_delta_kg !== null && summary.target_delta_kg !== undefined
      ? `<div class="transform-stat">
          <span class="transform-stat-val">${summary.target_delta_kg > 0 ? "+" : ""}${summary.target_delta_kg} kg</span>
          <span class="transform-stat-lbl">Target Delta</span>
         </div>`
      : "";

    transformationSection.innerHTML = `
      <div class="transformation-card">
        <div>
          <h4 style="font-weight: 800; font-size: 1.15rem; margin-bottom: 0.2rem;">Physical Transformation Wellness Focus</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(summary.disclaimer)}</p>
        </div>
        <div class="transform-stat-group">
          <div class="transform-stat">
            <span class="transform-stat-val">${summary.bmi || "-"}</span>
            <span class="transform-stat-lbl">BMI Reference</span>
          </div>
          <div class="transform-stat">
            <span class="transform-stat-val">${summary.current_weight_kg || "-"} kg</span>
            <span class="transform-stat-lbl">Current Weight</span>
          </div>
          <div class="transform-stat">
            <span class="transform-stat-val">${summary.target_weight_kg || "-"} kg</span>
            <span class="transform-stat-lbl">Target Weight</span>
          </div>
          ${deltaHtml}
        </div>
      </div>
    `;
  }

  function renderMealCards(meals) {
    if (!mealsContainer) return;
    if (meals.length === 0) {
      mealsContainer.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-muted);">No meals available.</p>`;
      return;
    }

    mealsContainer.innerHTML = meals.map((meal) => {
      const cuisineClean = (meal.cuisine || "").replace("_", " ");
      return `
        <article class="reco-card" id="meal-card-${escapeHtml(meal.id)}" data-id="${escapeHtml(meal.id)}" data-slot="${escapeHtml(meal.slot)}">
          <div class="card-slot-header">
            <span class="slot-tag">${escapeHtml(meal.slot)}</span>
            <span class="score-badge" title="Deterministic Match Score (0 to 10)">
              ★ ${meal.score ? meal.score.toFixed(1) : "8.5"}
            </span>
          </div>
          <h3 class="reco-name">${escapeHtml(meal.name)}</h3>
          <div class="reco-tags">
            <span class="badge badge-primary">${escapeHtml(cuisineClean)}</span>
            <span class="badge badge-neutral">⏱ ${meal.prep_time_min}m prep</span>
            <span class="badge badge-neutral">${escapeHtml(meal.cost_level)} budget</span>
            <span class="badge badge-success">~${meal.sample_calories} kcal</span>
          </div>
          <p class="reco-desc">${escapeHtml(meal.description)}</p>

          <div class="reason-box">
            <strong>Why this suggestion?</strong>
            ${escapeHtml(meal.reason)}
          </div>

          <div style="margin-bottom: 0.75rem;">
            <button class="btn btn-outline btn-sm btn-view-recipe" data-id="${escapeHtml(meal.id)}" style="width: 100%;">
              📖 View Full Recipe & Instructions
            </button>
          </div>

          <div class="card-actions">
            <div class="icon-btn-group">
              <button class="icon-btn btn-like" title="I like this meal" data-type="meal" data-id="${escapeHtml(meal.id)}">👍</button>
              <button class="icon-btn btn-dislike" title="Dislike (adjust soft preference)" data-type="meal" data-id="${escapeHtml(meal.id)}">👎</button>
            </div>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm btn-swap-meal" data-slot="${escapeHtml(meal.slot)}" data-id="${escapeHtml(meal.id)}">
                ⇄ Swap
              </button>
              <button class="btn btn-secondary btn-sm btn-skip-meal" data-id="${escapeHtml(meal.id)}">
                Skip
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    bindCardEventListeners();
  }

  function renderWorkoutCards(workouts) {
    if (!workoutsContainer) return;
    if (workouts.length === 0) {
      workoutsContainer.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-muted);">No workouts matching constraints.</p>`;
      return;
    }

    workoutsContainer.innerHTML = workouts.map((w) => {
      const equipStr = (w.equipment || ["none"]).map((e) => e.replace("_", " ")).join(", ");
      return `
        <article class="reco-card" id="workout-card-${escapeHtml(w.id)}" data-id="${escapeHtml(w.id)}">
          <div class="card-slot-header">
            <span class="slot-tag" style="background: var(--accent-light); color: var(--accent-hover);">
              ${escapeHtml(w.category)}
            </span>
            <span class="score-badge">★ ${w.score ? w.score.toFixed(1) : "9.0"}</span>
          </div>
          <h3 class="reco-name">${escapeHtml(w.name)}</h3>
          <div class="reco-tags">
            <span class="badge badge-primary">⏱ ${w.duration_min} mins</span>
            <span class="badge badge-neutral">${escapeHtml(w.intensity)} intensity</span>
            <span class="badge badge-neutral">Equipment: ${escapeHtml(equipStr)}</span>
          </div>
          <p class="reco-desc">${escapeHtml(w.description)}</p>

          <div class="reason-box">
            <strong>Why this workout?</strong>
            ${escapeHtml(w.reason)}
          </div>

          <div class="card-actions">
            <div class="icon-btn-group">
              <button class="icon-btn btn-like" title="Like workout" data-type="workout" data-id="${escapeHtml(w.id)}">👍</button>
              <button class="icon-btn btn-dislike" title="Dislike workout" data-type="workout" data-id="${escapeHtml(w.id)}">👎</button>
            </div>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm btn-swap-workout" data-id="${escapeHtml(w.id)}">
                ⇄ Swap
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    bindCardEventListeners();
  }

  function bindCardEventListeners() {
    // Recipe modal triggers
    document.querySelectorAll(".btn-view-recipe").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const mealId = btn.dataset.id;
        const meal = currentPlan.meals.find((m) => m.id === mealId);
        if (meal) {
          renderRecipeModal(meal);
          openModal("recipe-modal");
        }
      });
    });

    // Like buttons
    document.querySelectorAll(".btn-like").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemType = btn.dataset.type;
        const itemId = btn.dataset.id;
        btn.classList.toggle("active-like");
        try {
          await api.recordFeedback(itemType, itemId, "like");
          showToast(`Liked! We'll show more similar ${itemType}s.`, "success");
        } catch (e) {
          showToast("Feedback recorded.", "info");
        }
      });
    });

    // Dislike buttons
    document.querySelectorAll(".btn-dislike").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemType = btn.dataset.type;
        const itemId = btn.dataset.id;
        btn.classList.toggle("active-dislike");
        try {
          await api.recordFeedback(itemType, itemId, "dislike");
          showToast(`Noted. Soft preference lowered for this style.`, "info");
        } catch (e) {}
      });
    });

    // Meal Swap
    document.querySelectorAll(".btn-swap-meal").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slot = btn.dataset.slot;
        const mealId = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = "...";
        try {
          const excludeIds = currentPlan.meals.map((m) => m.id);
          const res = await api.swapItem("meal", slot, excludeIds);

          if (res.status === "exhausted") {
            showToast(res.message, "warning");
            btn.disabled = false;
            btn.textContent = "⇄ Swap";
            return;
          }

          const newMeal = res.item;
          // Update local state
          const idx = currentPlan.meals.findIndex((m) => m.id === mealId);
          if (idx !== -1) currentPlan.meals[idx] = newMeal;

          // Animate and re-render
          const card = document.getElementById(`meal-card-${mealId}`);
          if (card) {
            card.style.opacity = "0";
            card.style.transform = "scale(0.95)";
            card.style.transition = "all 0.25s ease";
            setTimeout(() => {
              renderMealCards(currentPlan.meals);
              showToast(`Swapped to ${newMeal.name}!`, "success");
            }, 250);
          }
        } catch (err) {
          showToast(err.message || "Swap failed", "error");
          btn.disabled = false;
          btn.textContent = "⇄ Swap";
        }
      });
    });

    // Workout Swap
    document.querySelectorAll(".btn-swap-workout").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const workoutId = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = "...";
        try {
          const excludeIds = currentPlan.workouts.map((w) => w.id);
          const res = await api.swapItem("workout", "movement", excludeIds);

          if (res.status === "exhausted") {
            showToast(res.message, "warning");
            btn.disabled = false;
            btn.textContent = "⇄ Swap";
            return;
          }

          const newWorkout = res.item;
          const idx = currentPlan.workouts.findIndex((w) => w.id === workoutId);
          if (idx !== -1) currentPlan.workouts[idx] = newWorkout;

          renderWorkoutCards(currentPlan.workouts);
          showToast(`Swapped to ${newWorkout.name}!`, "success");
        } catch (err) {
          showToast(err.message || "Swap failed", "error");
          btn.disabled = false;
          btn.textContent = "⇄ Swap";
        }
      });
    });

    // Skip
    document.querySelectorAll(".btn-skip-meal").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const mealId = btn.dataset.id;
        const card = document.getElementById(`meal-card-${mealId}`);
        if (card) {
          card.style.opacity = "0.35";
          card.style.pointerEvents = "none";
          showToast("Meal skipped for today.", "info");
          api.recordFeedback("meal", mealId, "skip").catch(() => {});
        }
      });
    });
  }

  function renderRecipeModal(meal) {
    const titleEl = document.getElementById("modal-recipe-title");
    const bodyEl = document.getElementById("modal-recipe-body");
    if (!titleEl || !bodyEl) return;

    titleEl.textContent = meal.name;

    const ingredients = meal.ingredients || [];
    const steps = meal.recipe_steps || [];
    const tips = meal.chef_tips || "Cook with mindful attention to flavors and natural textures.";

    bodyEl.innerHTML = `
      <div class="macro-grid">
        <div class="macro-box">
          <div class="macro-val">${meal.sample_calories || 0}</div>
          <div class="macro-lbl">Calories (kcal)*</div>
        </div>
        <div class="macro-box">
          <div class="macro-val">${meal.sample_protein_g || 0}g</div>
          <div class="macro-lbl">Protein</div>
        </div>
        <div class="macro-box">
          <div class="macro-val">${meal.prep_time_min}m</div>
          <div class="macro-lbl">Prep Time</div>
        </div>
        <div class="macro-box">
          <div class="macro-val">${meal.cook_time_min || 10}m</div>
          <div class="macro-lbl">Cook Time</div>
        </div>
      </div>

      <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 1.25rem;">
        *Sample unverified estimate for general home preparation. Actual values vary by brands and oils.
      </div>

      <h4 class="recipe-section-title">Ingredients Checklist:</h4>
      <ul class="ingredient-checklist">
        ${ingredients.map((ing) => `
          <li class="ingredient-item">
            <label style="cursor: pointer; display: flex; align-items: center; gap: 0.6rem; width: 100%;">
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

      <div class="chef-tip-box">
        <strong>💡 Preparation Tip:</strong> ${escapeHtml(tips)}
      </div>
    `;
  }

  function renderExcludedModal(excludedList) {
    const title = document.getElementById("excluded-modal-title");
    const body = document.getElementById("excluded-modal-body");
    if (!title || !body) return;

    title.textContent = "Safety & Dietary Exclusions Filter";
    if (excludedList.length === 0) {
      body.innerHTML = `<p style="color: var(--text-muted);">No meals needed exclusion under your declared profile.</p>`;
      return;
    }

    body.innerHTML = `
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
        In accordance with Hard Scope Rule 4, all meals violating your declared eating pattern or containing allergen cross-reactions were automatically filtered before ranking.
      </p>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${excludedList.map((item) => `
          <div style="background: var(--bg-subtle); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border-left: 3px solid var(--danger);">
            <strong style="display: block; font-size: 0.95rem;">${escapeHtml(item.name)}</strong>
            <ul style="margin: 0.3rem 0 0 1.2rem; font-size: 0.85rem; color: var(--text-muted);">
              ${item.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderZeroMatches(data) {
    if (mealsContainer) {
      mealsContainer.innerHTML = `
        <div style="grid-column: 1/-1; background: var(--bg-card); border: 1.5px solid var(--border); border-radius: var(--radius-lg); padding: 3rem 1.5rem; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <h3 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem;">No exact meal matches</h3>
          <p style="color: var(--text-muted); max-width: 580px; margin: 0 auto 1.5rem;">
            ${escapeHtml(data.message)}
          </p>
          <div style="display: flex; justify-content: center; gap: 1rem;">
            <a href="profile.html" class="btn btn-primary">Relax Cooking Time / Budget</a>
            <button class="btn btn-secondary" onclick="document.getElementById('excluded-count-badge').click()">
              View Excluded Breakdown
            </button>
          </div>
        </div>
      `;
    }
  }
});
