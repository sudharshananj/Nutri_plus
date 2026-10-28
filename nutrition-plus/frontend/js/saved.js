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

  const plansContainer = document.getElementById("saved-plans-container");
  await loadSavedPlans();

  async function loadSavedPlans() {
    if (!plansContainer) return;
    plansContainer.innerHTML = `<div class="skeleton" style="height: 200px; width: 100%;"></div>`;

    try {
      const data = await api.getPlans();
      const plans = data.plans || [];

      if (plans.length === 0) {
        plansContainer.innerHTML = `
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 3.5rem 1.5rem; text-align: center;">
            <div style="font-size: 2.8rem; margin-bottom: 0.8rem;">📋</div>
            <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 0.5rem;">No saved plans yet</h3>
            <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem;">
              When you generate a daily wellness plan you love, click "Save Plan" to store it here for offline reference.
            </p>
            <a href="profile.html" class="btn btn-primary">Generate a Plan</a>
          </div>
        `;
        return;
      }

      plansContainer.innerHTML = plans.map((p) => {
        const plan = p.plan || {};
        const meals = plan.meals || [];
        const workouts = plan.workouts || [];
        const dateStr = new Date(p.created_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });

        return `
          <div class="form-card" style="margin-bottom: 2rem; max-width: 100%;" id="saved-plan-${p.id}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 0.2rem;">${escapeHtml(p.title)}</h3>
                <span style="font-size: 0.82rem; color: var(--text-muted);">Saved on ${dateStr}</span>
              </div>
              <button class="btn btn-secondary btn-sm btn-delete-plan" data-id="${p.id}" style="color: var(--danger); border-color: var(--danger-bg);">
                🗑 Delete Plan
              </button>
            </div>

            <h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--primary);">
              🥗 Meal Ideas (${meals.length})
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">
              ${meals.map((m) => `
                <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-sm); border-left: 3px solid var(--primary);">
                  <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--primary);">${escapeHtml(m.slot || "meal")}</div>
                  <strong style="display: block; font-size: 0.95rem; margin: 0.2rem 0;">${escapeHtml(m.name)}</strong>
                  <button class="btn btn-outline btn-sm btn-saved-recipe" data-id="${escapeHtml(m.id)}" style="margin-top: 0.4rem; font-size: 0.75rem; padding: 0.2rem 0.5rem;">
                    View Recipe
                  </button>
                </div>
              `).join("")}
            </div>

            <h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--accent);">
              🏃 Movement Ideas (${workouts.length})
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
              ${workouts.map((w) => `
                <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-sm); border-left: 3px solid var(--accent);">
                  <strong style="display: block; font-size: 0.95rem;">${escapeHtml(w.name)}</strong>
                  <span style="font-size: 0.8rem; color: var(--text-muted);">${w.duration_min} min • ${escapeHtml(w.intensity)} intensity</span>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }).join("");

      bindPlanActions();

    } catch (err) {
      showToast(err.message || "Could not load saved plans.", "error");
    }
  }

  function bindPlanActions() {
    // Delete plan
    document.querySelectorAll(".btn-delete-plan").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const planId = btn.dataset.id;
        if (!confirm("Are you sure you want to delete this saved plan?")) return;

        btn.disabled = true;
        try {
          await api.deletePlan(planId);
          showToast("Plan deleted.", "info");
          const el = document.getElementById(`saved-plan-${planId}`);
          if (el) el.remove();
        } catch (err) {
          showToast(err.message || "Failed to delete plan", "error");
          btn.disabled = false;
        }
      });
    });

    // View recipe for meal in saved plan
    document.querySelectorAll(".btn-saved-recipe").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const mealId = btn.dataset.id;
        try {
          const meal = await api.getMealRecipe(mealId);
          renderRecipeModal(meal);
          openModal("recipe-modal");
        } catch (err) {
          showToast("Failed to fetch recipe details.", "error");
        }
      });
    });
  }

  function renderRecipeModal(meal) {
    const title = document.getElementById("modal-recipe-title");
    const body = document.getElementById("modal-recipe-body");
    if (!title || !body) return;

    title.textContent = meal.name;
    const ingredients = meal.ingredients || [];
    const steps = meal.recipe_steps || [];
    const tips = meal.chef_tips || "Cook with fresh herbs and mindful attention.";

    body.innerHTML = `
      <div style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.88rem;">
        Prep: ${meal.prep_time_min} mins | Cook: ${meal.cook_time_min || 10} mins
      </div>
      <h4 class="recipe-section-title">Ingredients:</h4>
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
      <h4 class="recipe-section-title">Instructions:</h4>
      <ol class="recipe-steps-list">
        ${steps.map((st) => `<li>${escapeHtml(st)}</li>`).join("")}
      </ol>
      <div class="chef-tip-box">
        <strong>Chef's Note:</strong> ${escapeHtml(tips)}
      </div>
    `;
  }
});
