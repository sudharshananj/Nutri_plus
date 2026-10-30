import { api } from "./api.js";
import { openExerciseDemoModal } from "./dummy_model.js";
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
  const weightGainStrategySection = document.getElementById("weight-gain-strategy-box");

  // 7-Day Split elements
  const splitDatePicker = document.getElementById("split-date-picker");
  const splitAssignedBanner = document.getElementById("split-assigned-banner");
  const splitWorkoutsGrid = document.getElementById("split-workouts-grid");
  const dayButtons = document.querySelectorAll(".day-btn");
  const splitGoalButtons = document.querySelectorAll(".split-goal-btn");
  const splitLocButtons = document.querySelectorAll(".split-loc-btn");

  let currentPlan = {
    meals: [],
    workouts: []
  };
  let excludedSample = [];
  let userProfile = null;

  // Split state
  const SPLIT_SCHEDULE = {
    monday: {
      name: "Monday",
      part: "chest",
      icon: "🛡️",
      title: "Chest & Triceps",
      tag: "Push Day Focus",
      desc: "Heavy pectoralis major pressing, anterior deltoid engagement, and direct triceps long-head overload."
    },
    tuesday: {
      name: "Tuesday",
      part: "back",
      icon: "🦅",
      title: "Back & Biceps",
      tag: "Pull Day Focus",
      desc: "Latissimus dorsi width, mid-back rhomboid thickness, and peak bicep supination."
    },
    wednesday: {
      name: "Wednesday",
      part: "legs",
      icon: "🦵",
      title: "Legs & Glutes",
      tag: "Leg Day Focus",
      desc: "Compound quad overloading, Romanian deadlifts for hamstrings, and explosive glute drive."
    },
    thursday: {
      name: "Thursday",
      part: "shoulders",
      icon: "🏹",
      title: "Shoulders & Traps",
      tag: "Deltoid Cap Focus",
      desc: "Vertical overhead military press, lateral raise breadth, and posture-reinforcing traps."
    },
    friday: {
      name: "Friday",
      part: "arms",
      icon: "💪",
      title: "Arms & Core",
      tag: "Guns & Abs Focus",
      desc: "Dedicated arm supersets (biceps & triceps) paired with deep abdominal transverse core stability."
    },
    saturday: {
      name: "Saturday",
      part: "full_body",
      icon: "⚡",
      title: "Full Body Power & Conditioning",
      tag: "Athletic Conditioning",
      desc: "Heavy compound deadlifts, thrusters, and explosive full-body calisthenic work capacity."
    },
    sunday: {
      name: "Sunday",
      part: "mobility",
      icon: "🧘",
      title: "Active Recovery & Mobility Flow",
      tag: "Restorative Flow",
      desc: "Spinal decompression, hip flexor release, and gentle aerobic blood flow for muscle repair."
    }
  };

  const DAYS_ORDER = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  let activeSplitDay = "monday";
  let activeSplitGoal = "all";
  let activeSplitLoc = "all";
  let allCatalogWorkouts = [];

  // Initialize Split Date Picker with Today's Date
  initDatePickerAndSplit();

  // Load and Render Recommendations
  await fetchAndDisplayRecommendations();

  // Load Catalog Workouts for the 7-Day Split Planner
  await loadAndRenderSplitWorkouts();

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

  // --- RECOMMENDATIONS LOGIC ---
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

      // Check user profile from session
      try {
        const pRes = await api.getProfile();
        userProfile = pRes && pRes.profile ? pRes.profile : null;
      } catch (e) {}

      // Update safety excluded badge
      if (excludedBadge) {
        excludedBadge.textContent = `🛡️ ${data.excluded_count} meals excluded for your safety & diet`;
        excludedBadge.style.display = "inline-flex";
      }

      // Render Transformation Context
      if (transformationSection && data.transformation_summary) {
        renderTransformationCard(data.transformation_summary);
      }

      // Render Weight Gaining Strategy if applicable
      renderWeightGainingStrategyCard(data.transformation_summary, userProfile);

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
    const deltaVal = summary.target_delta_kg;
    const isGain = deltaVal && deltaVal > 0;
    const isLoss = deltaVal && deltaVal < 0;

    const deltaHtml = deltaVal !== null && deltaVal !== undefined
      ? `<div class="transform-stat">
          <span class="transform-stat-val" style="color: ${isGain ? '#10b981' : isLoss ? '#38bdf8' : 'inherit'};">
            ${isGain ? "+" : ""}${deltaVal} kg
          </span>
          <span class="transform-stat-lbl">Target Delta (${isGain ? "Weight Gain" : isLoss ? "Weight Loss" : "Maintain"})</span>
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

  function renderWeightGainingStrategyCard(summary, profile) {
    if (!weightGainStrategySection) return;

    const isWeightGainGoal = profile && (profile.goal === "weight_gain" || profile.goal === "build_muscle");
    const isWeightGainDelta = summary && summary.target_delta_kg && summary.target_delta_kg > 0;

    if (!isWeightGainGoal && !isWeightGainDelta) {
      weightGainStrategySection.style.display = "none";
      return;
    }

    const curWeight = (summary && summary.current_weight_kg) || (profile && profile.current_weight_kg) || 65;
    const targetDelta = summary && summary.target_delta_kg ? summary.target_delta_kg : 5.0;

    // Approximate BMR & surplus
    const estMaintenance = Math.round(curWeight * 31);
    const surplusCals = 400;
    const dailyTargetCals = estMaintenance + surplusCals;
    const dailyProteinTarget = Math.round(curWeight * 1.8);

    weightGainStrategySection.style.display = "block";
    weightGainStrategySection.innerHTML = `
      <div class="form-card" style="border-left: 4px solid #10b981; background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(56, 189, 248, 0.05)); padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <span class="badge badge-success" style="margin-bottom: 0.4rem;">
              🏋️ Personalised Weight Gaining Blueprint
            </span>
            <h3 style="font-size: 1.5rem; font-weight: 800; line-height: 1.2;">
              Caloric Surplus & Muscle Hypertrophy Strategy (+${targetDelta} kg Goal)
            </h3>
            <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 0.25rem;">
              Calculated to safely promote lean muscle mass and healthy weight gain with clean, nutrient-dense nutrition.
            </p>
          </div>
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.75rem 1.25rem; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 1.8rem; font-weight: 900; color: #10b981; line-height: 1;">
              +${surplusCals} kcal
            </div>
            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #10b981;">
              Daily Surplus Target
            </div>
          </div>
        </div>

        <!-- Strategy Metrics Grid -->
        <div class="macro-grid" style="margin-bottom: 1.25rem;">
          <div class="macro-box">
            <div class="macro-val">~${estMaintenance} kcal</div>
            <div class="macro-lbl">Est. Maintenance</div>
          </div>
          <div class="macro-box" style="border-color: #10b981;">
            <div class="macro-val" style="color: #10b981;">~${dailyTargetCals} kcal</div>
            <div class="macro-lbl">Daily Target Surplus</div>
          </div>
          <div class="macro-box">
            <div class="macro-val">${dailyProteinTarget}g</div>
            <div class="macro-lbl">Protein Target (1.8g/kg)</div>
          </div>
          <div class="macro-box">
            <div class="macro-val">3-4 hrs</div>
            <div class="macro-lbl">Meal Frequency</div>
          </div>
        </div>

        <!-- Practical Weight Gaining Pillars -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; font-size: 0.88rem;">
          <div style="background: var(--bg-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm);">
            <strong style="color: #10b981; display: block; margin-bottom: 0.25rem;">🥑 1. Energy-Dense Healthy Additions:</strong>
            Incorporate wholesome natural calorie boosters into your meals without feeling bloated: 1-2 tbsp peanut butter, handfuls of roasted almonds/walnuts, desi cow ghee, chia seeds, and avocado.
          </div>
          <div style="background: var(--bg-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm);">
            <strong style="color: #38bdf8; display: block; margin-bottom: 0.25rem;">🏋️ 2. Progressive Overload Training:</strong>
            Prioritize our <strong>Build Muscle</strong> split exercises below with moderate-to-heavy resistance (8-12 reps). Lift progressively heavier over time to stimulate muscle protein synthesis rather than fat storage.
          </div>
          <div style="background: var(--bg-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm);">
            <strong style="color: #f59e0b; display: block; margin-bottom: 0.25rem;">🥣 3. Pre-Bed Slow-Release Protein:</strong>
            Consume our Greek yogurt parfait, whole milk oats, or paneer 45 minutes before sleep to provide slow-digesting casein protein that feeds your muscles overnight.
          </div>
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
      const bodyPart = (w.target_body_part || "Full Body").replace("_", " ").toUpperCase();
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
            <span class="badge badge-success">${escapeHtml(bodyPart)}</span>
            <span class="badge badge-neutral">${escapeHtml(w.intensity)} intensity</span>
            <span class="badge badge-neutral">Equip: ${escapeHtml(equipStr)}</span>
          </div>
          <p class="reco-desc">${escapeHtml(w.description)}</p>

          <div class="reason-box">
            <strong>Why this workout?</strong>
            ${escapeHtml(w.reason)}
          </div>

          <!-- Animated Dummy Model Demo Button -->
          <div style="margin-bottom: 0.75rem;">
            <button class="btn btn-primary btn-sm btn-watch-demo" data-id="${escapeHtml(w.id)}" style="width: 100%;">
              🎬 Watch Dummy Model Demo
            </button>
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

  // --- 7-DAY SPLIT PLANNER LOGIC ---
  function initDatePickerAndSplit() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (splitDatePicker) {
      splitDatePicker.value = todayStr;
      splitDatePicker.addEventListener("change", (e) => {
        handleDateSelection(e.target.value);
      });
    }

    // Set active day to today's day of week
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    activeSplitDay = DAYS_ORDER[dayOfWeek];

    // Day button clicks
    dayButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        activeSplitDay = btn.dataset.day;
        updateSplitUI();
      });
    });

    // Goal buttons
    splitGoalButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        splitGoalButtons.forEach((b) => b.classList.replace("btn-primary", "btn-secondary"));
        btn.classList.replace("btn-secondary", "btn-primary");
        activeSplitGoal = btn.dataset.goal;
        renderSplitWorkouts();
      });
    });

    // Location buttons (Gym vs Home)
    splitLocButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        splitLocButtons.forEach((b) => b.classList.replace("btn-primary", "btn-secondary"));
        btn.classList.replace("btn-secondary", "btn-primary");
        activeSplitLoc = btn.dataset.loc;
        renderSplitWorkouts();
      });
    });

    updateDayButtonsUI();
  }

  function handleDateSelection(dateString) {
    if (!dateString) return;
    const selectedDate = new Date(dateString + "T00:00:00");
    const dayIdx = selectedDate.getDay();
    activeSplitDay = DAYS_ORDER[dayIdx];
    updateSplitUI();
    showToast(`Assigned Routine: ${SPLIT_SCHEDULE[activeSplitDay].title} for ${selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`, "info");
  }

  function updateDayButtonsUI() {
    dayButtons.forEach((btn) => {
      if (btn.dataset.day === activeSplitDay) {
        btn.classList.replace("btn-secondary", "btn-primary");
        btn.style.boxShadow = "0 0 12px rgba(56, 189, 248, 0.4)";
      } else {
        btn.classList.replace("btn-primary", "btn-secondary");
        btn.style.boxShadow = "none";
      }
    });
  }

  function updateSplitUI() {
    updateDayButtonsUI();
    renderSplitBanner();
    renderSplitWorkouts();
  }

  function renderSplitBanner() {
    if (!splitAssignedBanner) return;
    const info = SPLIT_SCHEDULE[activeSplitDay];
    const selectedDateVal = splitDatePicker ? splitDatePicker.value : "";
    let dateFormatted = "";
    if (selectedDateVal) {
      const d = new Date(selectedDateVal + "T00:00:00");
      dateFormatted = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    }

    splitAssignedBanner.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="badge badge-primary" style="margin-bottom: 0.35rem;">
            ${escapeHtml(info.tag)} • ${escapeHtml(dateFormatted || info.name)}
          </span>
          <h3 style="font-size: 1.6rem; font-weight: 800; line-height: 1.2;">
            ${info.icon} Assigned Body Part: ${escapeHtml(info.title)}
          </h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.3rem; max-width: 680px;">
            ${escapeHtml(info.desc)}
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span class="badge badge-success" style="padding: 0.5rem 0.85rem; font-size: 0.85rem;">
            Target: ${(info.part || "full_body").toUpperCase()}
          </span>
        </div>
      </div>
    `;
  }

  async function loadAndRenderSplitWorkouts() {
    try {
      const res = await api.getCatalogWorkouts();
      allCatalogWorkouts = res.items || [];
      renderSplitBanner();
      renderSplitWorkouts();
    } catch (err) {
      console.warn("Could not fetch catalog workouts for split:", err);
    }
  }

  function renderSplitWorkouts() {
    if (!splitWorkoutsGrid) return;
    const info = SPLIT_SCHEDULE[activeSplitDay];
    const targetPart = info.part;

    // Filter by body part
    let filtered = allCatalogWorkouts.filter((w) => {
      const wPart = w.target_body_part || "full_body";
      if (targetPart === "full_body") {
        return wPart === "full_body";
      }
      if (targetPart === "mobility") {
        return wPart === "mobility" || w.category === "mobility" || w.category === "walk" || w.category === "yoga";
      }
      return wPart === targetPart || (targetPart === "arms" && (wPart === "arms" || wPart === "core"));
    });

    // Filter by environment (Gym vs Home)
    if (activeSplitLoc !== "all") {
      filtered = filtered.filter((w) => {
        const type = w.workout_type || "both";
        const equip = w.equipment || [];
        if (activeSplitLoc === "gym") {
          return type === "gym" || type === "both" || equip.includes("gym") || equip.includes("dumbbells");
        } else if (activeSplitLoc === "home") {
          return type === "home" || type === "both" || equip.includes("none") || equip.includes("resistance_band") || equip.includes("yoga_mat") || equip.includes("dumbbells");
        }
        return true;
      });
    }

    // Filter by goal (Build Muscle vs Weight Loss)
    if (activeSplitGoal !== "all") {
      filtered = filtered.filter((w) => {
        const goals = w.goal_focus || ["build_muscle", "weight_loss"];
        return goals.includes(activeSplitGoal);
      });
    }

    if (filtered.length === 0) {
      splitWorkoutsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem 1rem; background: var(--bg-card); border-radius: var(--radius-md);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏋️</div>
          <h4>No specific exercises matching the active filter combination</h4>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 0.3rem;">
            Try switching from "${activeSplitLoc.toUpperCase()}" to "All Workouts" or view all goals.
          </p>
        </div>
      `;
      return;
    }

    splitWorkoutsGrid.innerHTML = filtered.map((w) => {
      const equipStr = (w.equipment || ["none"]).map((e) => e.replace("_", " ")).join(", ");
      const isHome = w.workout_type === "home" || (w.equipment && w.equipment.includes("none"));
      const isGym = w.workout_type === "gym" || (w.equipment && w.equipment.includes("gym"));
      const envBadge = isGym && isHome ? "🏢 Gym / 🏠 Home" : isGym ? "🏢 Gym Workout" : "🏠 Home Workout";

      const showMusclePrescription = activeSplitGoal === "all" || activeSplitGoal === "build_muscle";
      const showLossPrescription = activeSplitGoal === "all" || activeSplitGoal === "weight_loss";

      return `
        <article class="reco-card" id="split-card-${escapeHtml(w.id)}" style="display: flex; flex-direction: column;">
          <div class="card-slot-header">
            <span class="slot-tag" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">
              ${escapeHtml(envBadge)}
            </span>
            <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; cursor: pointer; color: var(--text-muted);">
              <input type="checkbox" class="chk-exercise-done" data-name="${escapeHtml(w.name)}">
              <span>Mark Done</span>
            </label>
          </div>

          <h3 class="reco-name" style="margin-bottom: 0.5rem;">${escapeHtml(w.name)}</h3>

          <div class="reco-tags" style="margin-bottom: 0.75rem;">
            <span class="badge badge-primary">⏱ ${w.duration_min} mins</span>
            <span class="badge badge-success">${(w.target_body_part || "Full Body").toUpperCase()}</span>
            <span class="badge badge-neutral">Equip: ${escapeHtml(equipStr)}</span>
          </div>

          <p class="reco-desc" style="margin-bottom: 0.75rem;">${escapeHtml(w.description)}</p>

          <!-- Prescriptions Box -->
          <div style="margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
            ${showMusclePrescription ? `
              <div style="background: rgba(16, 185, 129, 0.08); border-left: 3px solid #10b981; padding: 0.45rem 0.65rem; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-size: 0.8rem;">
                <strong style="color: #10b981;">🏋️ Build Muscle:</strong> ${escapeHtml(w.sets_reps_muscle || "4 sets × 8-12 reps")}
              </div>
            ` : ""}
            ${showLossPrescription ? `
              <div style="background: rgba(56, 189, 248, 0.08); border-left: 3px solid #38bdf8; padding: 0.45rem 0.65rem; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-size: 0.8rem;">
                <strong style="color: #38bdf8;">🔥 Weight Loss:</strong> ${escapeHtml(w.sets_reps_loss || "3 sets × 15-20 reps")}
              </div>
            ` : ""}
          </div>

          <!-- Video Demo Button -->
          <div style="margin-top: auto; padding-top: 0.5rem;">
            <button class="btn btn-primary btn-sm btn-watch-demo" data-id="${escapeHtml(w.id)}" style="width: 100%;">
              🎬 Watch Dummy Model Demo
            </button>
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

    // Animated Dummy Model Demo Triggers (Works for both daily reco workouts and split workouts)
    document.querySelectorAll(".btn-watch-demo").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const workoutId = btn.dataset.id;
        // Search in split catalog workouts or daily workouts
        let found = (allCatalogWorkouts || []).find((w) => w.id === workoutId);
        if (!found && currentPlan && currentPlan.workouts) {
          found = currentPlan.workouts.find((w) => w.id === workoutId);
        }
        if (found) {
          openExerciseDemoModal(found);
        }
      };
    });

    // Checkbox Mark Done
    document.querySelectorAll(".chk-exercise-done").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const name = e.target.dataset.name;
        const card = e.target.closest(".reco-card");
        if (e.target.checked) {
          if (card) card.style.opacity = "0.6";
          showToast(`Completed: ${name}! Excellent work! 🎉`, "success");
        } else {
          if (card) card.style.opacity = "1";
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
          const idx = currentPlan.meals.findIndex((m) => m.id === mealId);
          if (idx !== -1) currentPlan.meals[idx] = newMeal;

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
