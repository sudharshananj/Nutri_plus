import { api } from "./api.js";
import { escapeHtml, initMobileNav, initThemeToggle, showToast } from "./utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  initThemeToggle();
  initMobileNav();

  // Wizard state
  let currentStep = 1;
  const totalSteps = 5;

  const state = {
    age: 25,
    height_cm: null,
    current_weight_kg: null,
    target_weight_kg: null,
    eating_pattern: "vegetarian",
    allergens: [],
    cuisines: ["south_indian", "north_indian"],
    budget_level: "low",
    max_cook_time_min: 30,
    goal: "balanced",
    activity_level: "light",
    equipment: ["none"],
    workout_minutes: 20
  };

  // Restore saved state from sessionStorage or API
  const cached = sessionStorage.getItem("nutrition_plus_profile_draft");
  if (cached) {
    try {
      Object.assign(state, JSON.parse(cached));
    } catch (e) {}
  } else {
    try {
      const remote = await api.getProfile();
      if (remote && remote.profile) {
        Object.assign(state, remote.profile);
      }
    } catch (e) {}
  }

  // Bind UI Elements
  bindInputs();
  renderStateToUI();
  updateStepVisibility();

  // Navigation handlers
  const nextBtn = document.getElementById("wizard-next-btn");
  const prevBtn = document.getElementById("wizard-prev-btn");
  const submitBtn = document.getElementById("wizard-submit-btn");

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (validateCurrentStep(currentStep)) {
        if (currentStep < totalSteps) {
          currentStep++;
          updateStepVisibility();
          if (currentStep === 5) renderReviewSummary();
        }
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentStep > 1) {
        currentStep--;
        updateStepVisibility();
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving & Generating Ideas...";
      try {
        await api.saveProfile(state);
        sessionStorage.setItem("nutrition_plus_active_profile", JSON.stringify(state));
        showToast("Profile configured successfully!", "success");
        setTimeout(() => {
          window.location.href = "results.html";
        }, 600);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Generate Recommendations";
        showToast(err.message || "Failed to save profile.", "error");
      }
    });
  }

  function bindInputs() {
    // 1. Age
    const ageInput = document.getElementById("input-age");
    if (ageInput) {
      ageInput.addEventListener("input", (e) => {
        state.age = parseInt(e.target.value) || 0;
        persistDraft();
      });
    }

    // Height & Weights
    const heightInput = document.getElementById("input-height");
    const curWeightInput = document.getElementById("input-current-weight");
    const tgtWeightInput = document.getElementById("input-target-weight");

    if (heightInput) {
      heightInput.addEventListener("input", (e) => {
        state.height_cm = e.target.value ? parseInt(e.target.value) : null;
        updateTransformationMetricsPreview();
        persistDraft();
      });
    }
    if (curWeightInput) {
      curWeightInput.addEventListener("input", (e) => {
        state.current_weight_kg = e.target.value ? parseFloat(e.target.value) : null;
        updateTransformationMetricsPreview();
        persistDraft();
      });
    }
    if (tgtWeightInput) {
      tgtWeightInput.addEventListener("input", (e) => {
        state.target_weight_kg = e.target.value ? parseFloat(e.target.value) : null;
        updateTransformationMetricsPreview();
        persistDraft();
      });
    }

    // Eating pattern radio selection cards
    document.querySelectorAll('input[name="eating_pattern"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        state.eating_pattern = e.target.value;
        highlightSelectionCards('input[name="eating_pattern"]');
        persistDraft();
      });
    });

    // Allergens checkboxes / chips
    document.querySelectorAll(".allergen-chip input").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "none") {
          if (e.target.checked) {
            state.allergens = [];
            document.querySelectorAll('.allergen-chip input:not([value="none"])').forEach((other) => {
              other.checked = false;
              other.closest(".chip").classList.remove("selected");
            });
          }
        } else {
          // If a specific allergen is checked, uncheck 'none'
          const noneCb = document.querySelector('.allergen-chip input[value="none"]');
          if (noneCb) {
            noneCb.checked = false;
            noneCb.closest(".chip").classList.remove("selected");
          }
          if (e.target.checked) {
            if (!state.allergens.includes(val)) state.allergens.push(val);
          } else {
            state.allergens = state.allergens.filter((a) => a !== val);
          }
        }
        cb.closest(".chip").classList.toggle("selected", cb.checked);
        persistDraft();
      });
    });

    // Cuisines chips
    document.querySelectorAll(".cuisine-chip input").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const val = e.target.value;
        if (e.target.checked) {
          if (!state.cuisines.includes(val)) state.cuisines.push(val);
        } else {
          state.cuisines = state.cuisines.filter((c) => c !== val);
        }
        cb.closest(".chip").classList.toggle("selected", cb.checked);
        persistDraft();
      });
    });

    // Budget radio cards
    document.querySelectorAll('input[name="budget_level"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        state.budget_level = e.target.value;
        highlightSelectionCards('input[name="budget_level"]');
        persistDraft();
      });
    });

    // Cook time slider
    const cookSlider = document.getElementById("cook-time-slider");
    const cookBadge = document.getElementById("cook-time-badge");
    if (cookSlider && cookBadge) {
      cookSlider.addEventListener("input", (e) => {
        state.max_cook_time_min = parseInt(e.target.value);
        cookBadge.textContent = `${state.max_cook_time_min} min`;
        persistDraft();
      });
    }

    // Goal select
    const goalSelect = document.getElementById("select-goal");
    if (goalSelect) {
      goalSelect.addEventListener("change", (e) => {
        state.goal = e.target.value;
        persistDraft();
      });
    }

    // Activity level cards
    document.querySelectorAll('input[name="activity_level"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        state.activity_level = e.target.value;
        highlightSelectionCards('input[name="activity_level"]');
        persistDraft();
      });
    });

    // Equipment chips
    document.querySelectorAll(".equipment-chip input").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const val = e.target.value;
        if (e.target.checked) {
          if (!state.equipment.includes(val)) state.equipment.push(val);
        } else {
          state.equipment = state.equipment.filter((eq) => eq !== val);
        }
        if (state.equipment.length === 0) state.equipment = ["none"];
        cb.closest(".chip").classList.toggle("selected", cb.checked);
        persistDraft();
      });
    });

    // Workout minutes slider
    const workoutSlider = document.getElementById("workout-time-slider");
    const workoutBadge = document.getElementById("workout-time-badge");
    if (workoutSlider && workoutBadge) {
      workoutSlider.addEventListener("input", (e) => {
        state.workout_minutes = parseInt(e.target.value);
        workoutBadge.textContent = `${state.workout_minutes} min`;
        persistDraft();
      });
    }
  }

  function renderStateToUI() {
    const ageInput = document.getElementById("input-age");
    if (ageInput && state.age) ageInput.value = state.age;

    const heightInput = document.getElementById("input-height");
    if (heightInput && state.height_cm) heightInput.value = state.height_cm;

    const curW = document.getElementById("input-current-weight");
    if (curW && state.current_weight_kg) curW.value = state.current_weight_kg;

    const tgtW = document.getElementById("input-target-weight");
    if (tgtW && state.target_weight_kg) tgtW.value = state.target_weight_kg;

    // Pattern
    const patternRadio = document.querySelector(`input[name="eating_pattern"][value="${state.eating_pattern}"]`);
    if (patternRadio) patternRadio.checked = true;
    highlightSelectionCards('input[name="eating_pattern"]');

    // Allergens
    if (state.allergens.length === 0) {
      const noneCb = document.querySelector('.allergen-chip input[value="none"]');
      if (noneCb) {
        noneCb.checked = true;
        noneCb.closest(".chip").classList.add("selected");
      }
    } else {
      state.allergens.forEach((alg) => {
        const cb = document.querySelector(`.allergen-chip input[value="${alg}"]`);
        if (cb) {
          cb.checked = true;
          cb.closest(".chip").classList.add("selected");
        }
      });
    }

    // Cuisines
    state.cuisines.forEach((c) => {
      const cb = document.querySelector(`.cuisine-chip input[value="${c}"]`);
      if (cb) {
        cb.checked = true;
        cb.closest(".chip").classList.add("selected");
      }
    });

    // Budget
    const bRadio = document.querySelector(`input[name="budget_level"][value="${state.budget_level}"]`);
    if (bRadio) bRadio.checked = true;
    highlightSelectionCards('input[name="budget_level"]');

    // Cooking time
    const cookSlider = document.getElementById("cook-time-slider");
    const cookBadge = document.getElementById("cook-time-badge");
    if (cookSlider && cookBadge) {
      cookSlider.value = state.max_cook_time_min;
      cookBadge.textContent = `${state.max_cook_time_min} min`;
    }

    // Goal
    const goalSelect = document.getElementById("select-goal");
    if (goalSelect) goalSelect.value = state.goal;

    // Activity
    const actRadio = document.querySelector(`input[name="activity_level"][value="${state.activity_level}"]`);
    if (actRadio) actRadio.checked = true;
    highlightSelectionCards('input[name="activity_level"]');

    // Equipment
    state.equipment.forEach((eq) => {
      const cb = document.querySelector(`.equipment-chip input[value="${eq}"]`);
      if (cb) {
        cb.checked = true;
        cb.closest(".chip").classList.add("selected");
      }
    });

    // Workout time
    const workoutSlider = document.getElementById("workout-time-slider");
    const workoutBadge = document.getElementById("workout-time-badge");
    if (workoutSlider && workoutBadge) {
      workoutSlider.value = state.workout_minutes;
      workoutBadge.textContent = `${state.workout_minutes} min`;
    }

    updateTransformationMetricsPreview();
  }

  function highlightSelectionCards(selector) {
    document.querySelectorAll(selector).forEach((input) => {
      const card = input.closest(".selection-card");
      if (card) {
        card.classList.toggle("selected", input.checked);
      }
    });
  }

  function updateStepVisibility() {
    document.querySelectorAll(".form-step").forEach((el, idx) => {
      el.classList.toggle("active", idx + 1 === currentStep);
    });

    document.querySelectorAll(".step-dot").forEach((dot, idx) => {
      dot.classList.toggle("active", idx + 1 === currentStep);
      dot.classList.toggle("completed", idx + 1 < currentStep);
    });

    const progressFill = document.getElementById("stepper-fill");
    if (progressFill) {
      const pct = ((currentStep - 1) / (totalSteps - 1)) * 100;
      progressFill.style.width = `${pct}%`;
    }

    const prevBtn = document.getElementById("wizard-prev-btn");
    const nextBtn = document.getElementById("wizard-next-btn");
    const submitBtn = document.getElementById("wizard-submit-btn");

    if (prevBtn) prevBtn.style.visibility = currentStep === 1 ? "hidden" : "visible";
    if (nextBtn) nextBtn.style.display = currentStep === totalSteps ? "none" : "inline-flex";
    if (submitBtn) submitBtn.style.display = currentStep === totalSteps ? "inline-flex" : "none";
  }

  function validateCurrentStep(step) {
    if (step === 1) {
      if (!state.age || state.age < 18) {
        showToast("This tool is strictly for adults 18+ only.", "error");
        return false;
      }
      if (state.age > 100) {
        showToast("Please enter an age between 18 and 100.", "error");
        return false;
      }
      if (!state.eating_pattern) {
        showToast("Please select your eating pattern.", "error");
        return false;
      }
    } else if (step === 2) {
      if (state.cuisines.length === 0) {
        showToast("Please choose at least one cuisine preference.", "warning");
        return false;
      }
    }
    return true;
  }

  function updateTransformationMetricsPreview() {
    const box = document.getElementById("metrics-preview-box");
    if (!box) return;

    if (state.height_cm && state.current_weight_kg) {
      const h_m = state.height_cm / 100.0;
      const bmi = (state.current_weight_kg / (h_m * h_m)).toFixed(1);
      let deltaText = "";
      if (state.target_weight_kg) {
        const diff = (state.target_weight_kg - state.current_weight_kg).toFixed(1);
        deltaText = diff > 0 ? `Target Delta: +${diff} kg` : `Target Delta: ${diff} kg`;
      }
      box.style.display = "block";
      box.innerHTML = `
        <strong>Wellness Context:</strong> BMI Reference ~${bmi} | ${deltaText || "Ongoing Maintenance"}
        <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
          *For general lifestyle and energy tracking only. Not a medical evaluation.
        </div>
      `;
    } else {
      box.style.display = "none";
    }
  }

  function renderReviewSummary() {
    const reviewList = document.getElementById("review-summary-list");
    if (!reviewList) return;

    const patternNames = {
      vegan: "Vegan",
      vegetarian: "Vegetarian",
      eggetarian: "Eggetarian",
      non_veg: "Non-Vegetarian",
      halal: "Halal",
      jain: "Jain"
    };

    const algStr = state.allergens.length > 0 ? state.allergens.join(", ") : "None declared";
    const cuisStr = state.cuisines.map((c) => c.replace("_", " ")).join(", ");

    reviewList.innerHTML = `
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <strong>Age:</strong> <span>${state.age} years (Adult 18+)</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <strong>Eating Pattern:</strong> <span>${patternNames[state.eating_pattern] || state.eating_pattern}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <strong>Declared Allergens:</strong> <span style="color: var(--danger); font-weight: 600;">${escapeHtml(algStr)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <strong>Preferred Cuisines:</strong> <span style="text-transform: capitalize;">${escapeHtml(cuisStr)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <strong>Max Cook Time:</strong> <span>${state.max_cook_time_min} minutes</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <strong>Budget Level:</strong> <span style="text-transform: capitalize;">${state.budget_level}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <strong>Wellness Goal:</strong> <span style="text-transform: capitalize;">${state.goal.replace("_", " ")}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <strong>Daily Workout Target:</strong> <span>${state.workout_minutes} minutes (${state.activity_level})</span>
      </div>
      ${
        state.height_cm && state.current_weight_kg
          ? `<div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <strong>Physical Transformation:</strong> 
              <span>${state.height_cm} cm | ${state.current_weight_kg} kg → ${state.target_weight_kg || state.current_weight_kg} kg</span>
            </div>`
          : ""
      }
    `;
  }

  function persistDraft() {
    sessionStorage.setItem("nutrition_plus_profile_draft", JSON.stringify(state));
  }
});
