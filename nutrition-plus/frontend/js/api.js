/**
 * Nutrition Plus - API Client & Session Manager
 * Enforces X-Session-Token header, unified error handling, and offline resilience.
 */

const API_BASE = "";

class ApiClient {
  constructor() {
    this.sessionToken = localStorage.getItem("nutrition_plus_session_token") || null;
  }

  async ensureSession() {
    if (this.sessionToken) return this.sessionToken;
    try {
      const res = await fetch(`${API_BASE}/api/session`, { method: "POST" });
      if (!res.ok) throw new Error("Could not initialize anonymous session.");
      const data = await res.json();
      this.sessionToken = data.session_token;
      localStorage.setItem("nutrition_plus_session_token", this.sessionToken);
      return this.sessionToken;
    } catch (err) {
      console.warn("Session auto-init failed (server may be offline):", err);
      return null;
    }
  }

  async request(endpoint, options = {}) {
    await this.ensureSession();

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (this.sessionToken) {
      headers["X-Session-Token"] = this.sessionToken;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit reached. Please wait a minute before making more requests.");
        }
        const errorMsg = data.error || `HTTP error ${response.status}`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.details = data.details || null;
        throw error;
      }

      return data;
    } catch (err) {
      if (!window.navigator.onLine) {
        throw new Error("You appear to be offline. Please verify your connection.");
      }
      throw err;
    }
  }

  // Profile Endpoints
  async getProfile() {
    return this.request("/api/profile", { method: "GET" });
  }

  async saveProfile(profileData) {
    return this.request("/api/profile", {
      method: "POST",
      body: jsonStringifySafe(profileData)
    });
  }

  // Recommendation Endpoints
  async getRecommendations(profileOverride = null) {
    const body = profileOverride ? jsonStringifySafe(profileOverride) : "{}";
    return this.request("/api/recommendations", {
      method: "POST",
      body
    });
  }

  async swapItem(itemType, slot, excludeIds = [], profile = null) {
    return this.request("/api/recommendations/swap", {
      method: "POST",
      body: jsonStringifySafe({
        item_type: itemType,
        slot,
        exclude_ids: excludeIds,
        profile
      })
    });
  }

  // Feedback Endpoint
  async recordFeedback(itemType, itemId, action) {
    return this.request("/api/feedback", {
      method: "POST",
      body: jsonStringifySafe({
        item_type: itemType,
        item_id: itemId,
        action
      })
    });
  }

  // Saved Plans Endpoints
  async savePlan(title, plan) {
    return this.request("/api/plans", {
      method: "POST",
      body: jsonStringifySafe({ title, plan })
    });
  }

  async getPlans() {
    return this.request("/api/plans", { method: "GET" });
  }

  async deletePlan(planId) {
    return this.request(`/api/plans/${planId}`, { method: "DELETE" });
  }

  // Catalog & Recipe
  async getCatalogMeals(page = 1, perPage = 12, filters = {}) {
    const params = new URLSearchParams({ page, per_page: perPage, ...filters });
    return this.request(`/api/catalog/meals?${params.toString()}`, { method: "GET" });
  }

  async getMealRecipe(mealId) {
    return this.request(`/api/meals/${encodeURIComponent(mealId)}/recipe`, { method: "GET" });
  }

  // Food Scanner & Calorie Detection
  async scanFood(payload) {
    // Supports either JSON or FormData
    if (payload instanceof FormData) {
      await this.ensureSession();
      const headers = {};
      if (this.sessionToken) headers["X-Session-Token"] = this.sessionToken;
      const res = await fetch(`${API_BASE}/api/scan-food`, {
        method: "POST",
        headers,
        body: payload
      });
      return res.json();
    }
    return this.request("/api/scan-food", {
      method: "POST",
      body: jsonStringifySafe(payload)
    });
  }
}

function jsonStringifySafe(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return "{}";
  }
}

export const api = new ApiClient();
