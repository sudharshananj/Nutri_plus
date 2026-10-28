/**
 * Nutrition Plus - Shared Utility Library
 * Security: Uses strict text escaping to prevent XSS.
 * Theme: Black, Red & Metallic Old Gold (Defaults to Dark Mode with seamless Light/Dark toggle).
 */

// Secure HTML String Escaper
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global Toast Notification Manager
export function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.role = "status";

  const icons = {
    success: "✓",
    error: "✕",
    info: "⚡",
    warning: "⚠"
  };

  const iconSpan = document.createElement("span");
  iconSpan.textContent = icons[type] || "•";
  iconSpan.style.fontWeight = "bold";
  iconSpan.style.color = "var(--gold)";

  const textSpan = document.createElement("span");
  textSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Dark / Light Theme Toggle with LocalStorage Persistence
export function initThemeToggle() {
  const toggleBtn = document.getElementById("theme-toggle");

  // Default to luxurious Dark Mode
  const currentTheme = localStorage.getItem("nutrition_plus_theme") || "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  if (document.body) document.body.setAttribute("data-theme", currentTheme);

  if (toggleBtn) {
    updateThemeIcon(toggleBtn, currentTheme);

    // Remove old listeners to avoid multiple fires
    toggleBtn.onclick = () => {
      const active = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", active);
      if (document.body) document.body.setAttribute("data-theme", active);
      localStorage.setItem("nutrition_plus_theme", active);
      updateThemeIcon(toggleBtn, active);
    };
  }

  // Also expose globally for inline HTML click fallback
  window.toggleTheme = () => {
    const active = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", active);
    if (document.body) document.body.setAttribute("data-theme", active);
    localStorage.setItem("nutrition_plus_theme", active);
    const btn = document.getElementById("theme-toggle");
    if (btn) updateThemeIcon(btn, active);
  };
}

function updateThemeIcon(btn, theme) {
  // In dark mode show sun (to switch to light); in light mode show moon
  btn.textContent = theme === "dark" ? "☀️" : "🌙";
  btn.setAttribute("title", `Switch to ${theme === "dark" ? "Light Mode" : "Night Mode"}`);
  btn.setAttribute("aria-label", `Switch to ${theme === "dark" ? "Light Mode" : "Night Mode"}`);
}

// Mobile Hamburger Navigation Drawer
export function initMobileNav() {
  const hamburger = document.getElementById("hamburger-btn");
  const navLinks = document.getElementById("nav-links");
  if (!hamburger || !navLinks) return;

  hamburger.onclick = () => {
    const isOpen = navLinks.classList.toggle("mobile-open");
    hamburger.setAttribute("aria-expanded", String(isOpen));
    hamburger.textContent = isOpen ? "✕" : "☰";
  };

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove("mobile-open");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.textContent = "☰";
    }
  });
}

// Modal Helpers
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

export function setupModalDismiss(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("modal-close-btn")) {
      closeModal(modalId);
    }
  });
}
