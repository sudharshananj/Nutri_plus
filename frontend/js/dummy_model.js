/**
 * Realistic Biomechanical Muscular Mannequin 3D Engine
 * - Anatomically contoured muscular volumes: sculpted pectorals, 6-pack abs,
 *   V-taper lats, rounded deltoid caps, peaked biceps, horseshoe triceps,
 *   quadriceps teardrops, athletic glutes, and sculpted gastrocnemius calves.
 * - Continuous 360-degree orbital rotation from any angle (drag to orbit, front,
 *   3/4 isometric, side, back view, or auto-spin).
 * - Biomechanically accurate kinematics for all 22 workout models.
 * - Real-time active muscle hypertrophy contraction heatmap glowing in sync with rep tempo.
 */

export class DummyModelPlayer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.animationFrameId = null;
    this.isPlaying = true;
    this.speed = 1.0;
    this.yawAngle = 90; // Default side profile in degrees (0 to 360)
    this.pitchAngle = 6; // Slight perspective tilt for realistic depth
    this.isAutoSpinning = false;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.repCount = 0;
    this.currentModel = "squat";
    this.startTime = performance.now();
    this.lastPhase = 0;
    this.activeWorkout = null;
    this.showHeatmap = true;

    this.initInteraction();
  }

  initInteraction() {
    if (!this.canvas) return;

    // Mouse drag rotation
    this.canvas.style.cursor = "grab";
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.isAutoSpinning = false;
      this.lastMouseX = e.clientX;
      this.canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      this.lastMouseX = e.clientX;
      this.setAngle(this.yawAngle + dx * 0.75);
    });

    window.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.canvas) this.canvas.style.cursor = "grab";
      }
    });

    // Touch support for mobile devices
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.isAutoSpinning = false;
        this.lastMouseX = e.touches[0].clientX;
      }
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (!this.isDragging || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      this.lastMouseX = e.touches[0].clientX;
      this.setAngle(this.yawAngle + dx * 0.75);
    }, { passive: true });

    window.addEventListener("touchend", () => {
      this.isDragging = false;
    });
  }

  setAngle(deg) {
    this.yawAngle = ((deg % 360) + 360) % 360;
    this.updateAngleDisplay();
  }

  setPresetView(viewName) {
    this.isAutoSpinning = false;
    switch (viewName) {
      case "front":
        this.setAngle(0);
        break;
      case "iso":
        this.setAngle(45);
        break;
      case "side":
        this.setAngle(90);
        break;
      case "back":
        this.setAngle(180);
        break;
      case "spin":
        this.isAutoSpinning = !this.isAutoSpinning;
        break;
      default:
        this.setAngle(90);
    }
  }

  toggleView() {
    // Cycles through Front -> 3/4 -> Side -> Back
    if (this.yawAngle < 30 || this.yawAngle >= 330) {
      this.setAngle(45);
      return "3/4 View";
    } else if (this.yawAngle >= 30 && this.yawAngle < 75) {
      this.setAngle(90);
      return "Side View";
    } else if (this.yawAngle >= 75 && this.yawAngle < 150) {
      this.setAngle(180);
      return "Back View";
    } else {
      this.setAngle(0);
      return "Front View";
    }
  }

  updateAngleDisplay() {
    const angleEl = document.getElementById("demo-angle-display");
    if (!angleEl) return;
    const rounded = Math.round(this.yawAngle);
    let label = "Free Orbit";
    if (rounded >= 345 || rounded <= 15) label = "Front View";
    else if (rounded >= 30 && rounded <= 60) label = "3/4 View";
    else if (rounded >= 75 && rounded <= 105) label = "Side Profile";
    else if (rounded >= 165 && rounded <= 195) label = "Back View";
    else if (rounded >= 255 && rounded <= 285) label = "Left Profile";
    angleEl.textContent = `${rounded}° (${label})`;
  }

  setWorkout(workout) {
    this.activeWorkout = workout;
    this.currentModel = workout.demo_model || "squat";

    // Set most intuitive default starting angle for each exercise
    if (["bicep_curl", "lateral_raise", "calf_raise", "bicycle_crunch"].includes(this.currentModel)) {
      this.yawAngle = 0; // Front
    } else if (["lat_pulldown"].includes(this.currentModel)) {
      this.yawAngle = 180; // Back to showcase lat development
    } else if (["overhead_press", "bent_row"].includes(this.currentModel)) {
      this.yawAngle = 45; // 3/4 view
    } else {
      this.yawAngle = 90; // Side profile
    }

    this.repCount = 0;
    this.lastPhase = 0;
    this.startTime = performance.now();
    this.updateAngleDisplay();
  }

  start() {
    if (!this.ctx) return;
    this.isPlaying = true;
    const animate = (timestamp) => {
      if (this.isPlaying) {
        if (this.isAutoSpinning) {
          this.setAngle(this.yawAngle + 0.6);
        }
        this.render(timestamp);
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(animate);
  }

  stop() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    return this.isPlaying;
  }

  setSpeed(s) {
    this.speed = s;
  }

  // 3D Matrix Projection Transform
  project3D(pt, cx, cy) {
    const radY = (this.yawAngle * Math.PI) / 180;
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);
    const radP = (this.pitchAngle * Math.PI) / 180;
    const cosP = Math.cos(radP);
    const sinP = Math.sin(radP);

    // Yaw rotation (horizontal 360 orbit)
    const x1 = pt[0] * cosY - pt[2] * sinY;
    const z1 = pt[0] * sinY + pt[2] * cosY;

    // Pitch tilt (vertical isometric elevation)
    const y1 = pt[1] * cosP - z1 * sinP;
    const z2 = pt[1] * sinP + z1 * cosP;

    // Depth perspective
    const fov = 750;
    const scale = fov / (fov + z2 * 0.6);

    return {
      x: cx + x1 * scale,
      y: cy + y1 * scale,
      z: z2,
      scale: scale
    };
  }

  render(timestamp) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Studio Environment & 3D Floor Grid
    this.drawStudio(ctx, w, h);

    // Repetition normalized cycle (0.0 to 1.0)
    const baseDuration = 3600 / this.speed;
    const elapsed = timestamp - this.startTime;
    const rawPhase = (elapsed % baseDuration) / baseDuration;

    if (rawPhase < this.lastPhase && elapsed > 500) {
      this.repCount++;
      const repEl = document.getElementById("demo-rep-counter");
      if (repEl) repEl.textContent = this.repCount;
    }
    this.lastPhase = rawPhase;

    this.updateTempoUI(rawPhase);

    // Kinematic phase curve (0 eccentric -> 1 peak hold -> 0 concentric)
    let t;
    if (rawPhase < 0.45) {
      t = 0.5 - 0.5 * Math.cos((rawPhase / 0.45) * Math.PI);
    } else if (rawPhase < 0.55) {
      t = 1.0;
    } else {
      t = 0.5 + 0.5 * Math.cos(((rawPhase - 0.55) / 0.45) * Math.PI);
    }

    ctx.save();
    this.renderExercise3D(ctx, w, h, t, rawPhase, this.currentModel);
    ctx.restore();
  }

  drawStudio(ctx, w, h) {
    // High-tech dark gradient studio
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 1.1);
    bgGrad.addColorStop(0, "#161b2e");
    bgGrad.addColorStop(0.65, "#0b0f19");
    bgGrad.addColorStop(1, "#06070a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Floor perspective ring
    const floorY = h - 45;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w / 2, floorY, w * 0.45, 32, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Studio grid rings
    ctx.beginPath();
    ctx.ellipse(w / 2, floorY, w * 0.28, 18, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(212, 175, 55, 0.2)";
    ctx.stroke();
    ctx.restore();
  }

  updateTempoUI(phase) {
    const tempoBadge = document.getElementById("demo-tempo-badge");
    const progressFill = document.getElementById("demo-tempo-fill");
    if (progressFill) {
      progressFill.style.width = `${Math.round(phase * 100)}%`;
    }
    if (!tempoBadge) return;

    if (phase < 0.45) {
      tempoBadge.innerHTML = "⬇️ <strong>Eccentric:</strong> Controlled lowering (3s)";
      tempoBadge.style.color = "#38bdf8";
    } else if (phase >= 0.45 && phase < 0.55) {
      tempoBadge.innerHTML = "⏸️ <strong>Peak Hold:</strong> Muscle isometric tension (1s)";
      tempoBadge.style.color = "#f59e0b";
    } else {
      tempoBadge.innerHTML = "⬆️ <strong>Concentric:</strong> Explosive drive up (2s)";
      tempoBadge.style.color = "#10b981";
    }
  }

  // =========================================================================
  // Realistic Muscular Body Part Renderers
  // =========================================================================

  // Muscle color palette with 3D metallic highlights and contraction heatmaps
  getMuscleColor(isActive, isBack) {
    if (isActive) {
      return {
        fill: "rgba(225, 29, 72, 0.92)",
        highlight: "#f43f5e",
        shadow: "#881337",
        glow: "rgba(225, 29, 72, 0.65)"
      };
    }
    if (isBack) {
      return {
        fill: "rgba(51, 65, 85, 0.95)",
        highlight: "#64748b",
        shadow: "#1e293b",
        glow: null
      };
    }
    return {
      fill: "rgba(71, 85, 105, 0.95)",
      highlight: "#94a3b8",
      shadow: "#334155",
      glow: null
    };
  }

  drawMuscularHead(ctx, headPt, neckPt) {
    const hx = headPt.x;
    const hy = headPt.y;
    const scale = headPt.scale;
    const rad = (this.yawAngle * Math.PI) / 180;
    const isBack = Math.cos(rad) < -0.15;

    // Muscular neck
    ctx.beginPath();
    ctx.moveTo(hx - 10 * scale, hy + 12 * scale);
    ctx.lineTo(neckPt.x - 14 * scale, neckPt.y);
    ctx.lineTo(neckPt.x + 14 * scale, neckPt.y);
    ctx.lineTo(hx + 10 * scale, hy + 12 * scale);
    ctx.closePath();
    ctx.fillStyle = isBack ? "#334155" : "#475569";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sculpted Head & Jaw
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(hx, hy, 16 * scale, 22 * scale, 0, 0, Math.PI * 2);
    const grad = ctx.createLinearGradient(hx - 15 * scale, hy - 20 * scale, hx + 15 * scale, hy + 20 * scale);
    grad.addColorStop(0, "#94a3b8");
    grad.addColorStop(0.5, "#475569");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eye visor / tech facial contour
    if (!isBack) {
      const faceOffset = Math.sin(rad) * 6 * scale;
      ctx.beginPath();
      ctx.ellipse(hx + faceOffset, hy - 2 * scale, 8 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  drawMuscularTorso(ctx, chestPt, waistPt, pelvisPt, activeGroup = null) {
    const scale = (chestPt.scale + pelvisPt.scale) / 2;
    const rad = (this.yawAngle * Math.PI) / 180;
    const cosY = Math.cos(rad);
    const isBack = cosY < -0.15;

    const shoulderSpread = 34 * scale;
    const waistSpread = 19 * scale;
    const pelvisSpread = 24 * scale;

    const isChestActive = activeGroup === "chest";
    const isBackActive = activeGroup === "back" || activeGroup === "lats";
    const isCoreActive = activeGroup === "core";

    const style = this.getMuscleColor(isBack ? isBackActive : (isChestActive || isCoreActive), isBack);

    // Torso V-Taper Hull
    ctx.save();
    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = 18;
    }

    ctx.beginPath();
    ctx.moveTo(chestPt.x - shoulderSpread, chestPt.y);
    ctx.bezierCurveTo(chestPt.x - waistSpread - 8 * scale, waistPt.y - 10 * scale, waistPt.x - waistSpread, waistPt.y, waistPt.x - waistSpread, waistPt.y);
    ctx.lineTo(pelvisPt.x - pelvisSpread, pelvisPt.y);
    ctx.lineTo(pelvisPt.x + pelvisSpread, pelvisPt.y);
    ctx.lineTo(waistPt.x + waistSpread, waistPt.y);
    ctx.bezierCurveTo(chestPt.x + waistSpread + 8 * scale, waistPt.y - 10 * scale, chestPt.x + shoulderSpread, chestPt.y, chestPt.x + shoulderSpread, chestPt.y);
    ctx.closePath();

    const tGrad = ctx.createLinearGradient(chestPt.x - shoulderSpread, chestPt.y, chestPt.x + shoulderSpread, pelvisPt.y);
    tGrad.addColorStop(0, style.highlight);
    tGrad.addColorStop(0.5, style.fill);
    tGrad.addColorStop(1, style.shadow);
    ctx.fillStyle = tGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Muscular Anatomical Lines
    if (!isBack && Math.abs(cosY) > 0.3) {
      // Pectoral Plates (Chest)
      const pecY = chestPt.y + 8 * scale;
      ctx.strokeStyle = isChestActive ? "#ffffff" : "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Left pec
      ctx.ellipse(chestPt.x - 14 * scale, pecY, 13 * scale, 9 * scale, -0.1, 0, Math.PI * 2);
      // Right pec
      ctx.ellipse(chestPt.x + 14 * scale, pecY, 13 * scale, 9 * scale, 0.1, 0, Math.PI * 2);
      ctx.stroke();

      // Sternal Center Divisor
      ctx.beginPath();
      ctx.moveTo(chestPt.x, chestPt.y - 6 * scale);
      ctx.lineTo(chestPt.x, waistPt.y);
      ctx.stroke();

      // 6-Pack Rectus Abdominis
      const absColor = isCoreActive ? "#facc15" : "rgba(255, 255, 255, 0.2)";
      ctx.strokeStyle = absColor;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const rowY = waistPt.y - 16 * scale + i * 11 * scale;
        ctx.beginPath();
        ctx.roundRect(chestPt.x - 12 * scale, rowY, 10 * scale, 8 * scale, 2);
        ctx.roundRect(chestPt.x + 2 * scale, rowY, 10 * scale, 8 * scale, 2);
        ctx.stroke();
      }
    } else if (isBack && Math.abs(cosY) > 0.3) {
      // Dorsal Musculature: Trapezius Diamond & Latissimus Dorsi
      ctx.strokeStyle = isBackActive ? "#facc15" : "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2;
      // Trapezius diamond
      ctx.beginPath();
      ctx.moveTo(chestPt.x, chestPt.y - 12 * scale);
      ctx.lineTo(chestPt.x - 22 * scale, chestPt.y + 8 * scale);
      ctx.lineTo(chestPt.x, waistPt.y - 5 * scale);
      ctx.lineTo(chestPt.x + 22 * scale, chestPt.y + 8 * scale);
      ctx.closePath();
      ctx.stroke();

      // Spine channel
      ctx.beginPath();
      ctx.moveTo(chestPt.x, chestPt.y - 12 * scale);
      ctx.lineTo(chestPt.x, pelvisPt.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMuscularLimb(ctx, p1, p2, radius1, radius2, active = false, label = "") {
    const scale = (p1.scale + p2.scale) / 2;
    const r1 = radius1 * scale;
    const r2 = radius2 * scale;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;

    const angle = Math.atan2(dy, dx);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);

    const style = this.getMuscleColor(active, false);

    ctx.save();
    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = 16;
    }

    // Sculpted teardrop belly contour
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const midR = ((r1 + r2) / 2) * 1.28; // Muscular bulge

    ctx.beginPath();
    ctx.moveTo(p1.x + nx * r1, p1.y + ny * r1);
    ctx.quadraticCurveTo(midX + nx * midR, midY + ny * midR, p2.x + nx * r2, p2.y + ny * r2);
    ctx.lineTo(p2.x - nx * r2, p2.y - ny * r2);
    ctx.quadraticCurveTo(midX - nx * midR, midY - ny * midR, p1.x - nx * r1, p1.y - ny * r1);
    ctx.closePath();

    const grad = ctx.createLinearGradient(p1.x - nx * midR, p1.y - ny * midR, p1.x + nx * midR, p1.y + ny * midR);
    grad.addColorStop(0, style.shadow);
    grad.addColorStop(0.4, style.highlight);
    grad.addColorStop(1, style.fill);

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawDeltoid(ctx, p, active = false) {
    const scale = p.scale;
    const style = this.getMuscleColor(active, false);

    ctx.save();
    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 14 * scale, 12 * scale, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(p.x - 3 * scale, p.y - 3 * scale, 2 * scale, p.x, p.y, 14 * scale);
    grad.addColorStop(0, style.highlight);
    grad.addColorStop(0.7, style.fill);
    grad.addColorStop(1, style.shadow);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  drawGymBarbell(ctx, p1, p2, plateRadius = 24) {
    const scale = (p1.scale + p2.scale) / 2;
    // Steel knurled shaft
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 5 * scale;
    ctx.lineCap = "round";
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Olympic Bumper Plates
    [p1, p2].forEach(p => {
      ctx.fillStyle = "#e11d48";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 6 * scale, plateRadius * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Outer rim
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3 * scale, (plateRadius * 0.6) * scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
    });
    ctx.restore();
  }

  drawDumbbell(ctx, p, len = 24) {
    const scale = p.scale;
    const l = len * scale;
    ctx.save();
    // Center handle
    ctx.beginPath();
    ctx.moveTo(p.x - l / 2, p.y);
    ctx.lineTo(p.x + l / 2, p.y);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 4 * scale;
    ctx.stroke();

    // Hex Heads
    ctx.fillStyle = "#334155";
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(p.x - l / 2 - 5 * scale, p.y - 10 * scale, 8 * scale, 20 * scale, 2);
    ctx.roundRect(p.x + l / 2 - 3 * scale, p.y - 10 * scale, 8 * scale, 20 * scale, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // =========================================================================
  // 3D Biomechanical Exercise Kinematic Solver
  // =========================================================================
  renderExercise3D(ctx, w, h, t, phase, model) {
    const cx = w / 2;
    const cy = h / 2 + 10;
    const floorY = h / 2 + 115;

    // Master 3D Joint Rig Coordinate Table (x = left/right, y = up/down, z = front/back)
    let rig = {
      head: [0, -115, 0],
      neck: [0, -92, 0],
      shoulderL: [-28, -82, 0],
      shoulderR: [28, -82, 0],
      elbowL: [-35, -45, 0],
      elbowR: [35, -45, 0],
      wristL: [-35, -10, 0],
      wristR: [35, -10, 0],
      chest: [0, -75, 0],
      waist: [0, -40, 0],
      pelvis: [0, -15, 0],
      hipL: [-18, -15, 0],
      hipR: [18, -15, 0],
      kneeL: [-19, 45, 0],
      kneeR: [19, 45, 0],
      ankleL: [-18, 105, 0],
      ankleR: [18, 105, 0],
      activeGroup: "full_body"
    };

    let barbell = null;
    let dumbbells = null;
    let gymBench = null;
    let cableBar = null;

    // Biomechanical Kinematic Trajectories for all 22 Models
    switch (model) {
      case "squat": {
        rig.activeGroup = "quads";
        const drop = t * 68;
        const hipShiftZ = -t * 38;
        const kneeShiftZ = t * 24;

        rig.pelvis[1] += drop;
        rig.pelvis[2] += hipShiftZ;
        rig.waist[1] += drop * 0.95;
        rig.waist[2] += hipShiftZ * 0.7;
        rig.chest[1] += drop * 0.9;
        rig.chest[2] += hipShiftZ * 0.4;
        rig.neck[1] += drop * 0.88;
        rig.head[1] += drop * 0.88;

        rig.hipL[1] += drop; rig.hipL[2] += hipShiftZ;
        rig.hipR[1] += drop; rig.hipR[2] += hipShiftZ;

        rig.kneeL[1] += drop * 0.35; rig.kneeL[2] += kneeShiftZ;
        rig.kneeR[1] += drop * 0.35; rig.kneeR[2] += kneeShiftZ;

        // Hands hold barbell on traps
        rig.elbowL = [-38, rig.shoulderL[1] + 25, -12];
        rig.elbowR = [38, rig.shoulderR[1] + 25, -12];
        rig.wristL = [-34, rig.neck[1] + 4, -4];
        rig.wristR = [34, rig.neck[1] + 4, -4];

        barbell = {
          p1: [-65, rig.neck[1], -5],
          p2: [65, rig.neck[1], -5]
        };
        break;
      }

      case "bench_press": {
        rig.activeGroup = "chest";
        // Lying down flat on bench (rotated horizontally)
        const benchH = 15;
        gymBench = { y: benchH };

        const pressY = -65 + t * 45; // Descend to chest
        rig.head = [0, benchH - 12, -75];
        rig.neck = [0, benchH - 8, -55];
        rig.chest = [0, benchH - 4, -30];
        rig.waist = [0, benchH - 2, 0];
        rig.pelvis = [0, benchH, 30];

        rig.shoulderL = [-24, benchH - 6, -30];
        rig.shoulderR = [24, benchH - 6, -30];

        const elbowSpread = 28 + (1 - t) * 10;
        rig.elbowL = [-elbowSpread, benchH + 12 - t * 14, -30];
        rig.elbowR = [elbowSpread, benchH + 12 - t * 14, -30];

        rig.wristL = [-26, pressY, -30];
        rig.wristR = [26, pressY, -30];

        // Legs bent down to floor
        rig.hipL = [-16, benchH, 30]; rig.hipR = [16, benchH, 30];
        rig.kneeL = [-28, benchH + 30, 48]; rig.kneeR = [28, benchH + 30, 48];
        rig.ankleL = [-28, benchH + 85, 48]; rig.ankleR = [28, benchH + 85, 48];

        barbell = {
          p1: [-65, pressY, -30],
          p2: [65, pressY, -30]
        };
        break;
      }

      case "pushup":
      case "diamond_pushup": {
        rig.activeGroup = model === "diamond_pushup" ? "triceps" : "chest";
        const isDiamond = model === "diamond_pushup";
        const dip = t * 45;

        // Planking horizontal posture
        rig.head = [0, 10 + dip, 85];
        rig.neck = [0, 18 + dip, 65];
        rig.chest = [0, 24 + dip, 40];
        rig.waist = [0, 32 + dip * 0.7, 0];
        rig.pelvis = [0, 40 + dip * 0.5, -40];

        rig.shoulderL = [-22, 24 + dip, 40];
        rig.shoulderR = [22, 24 + dip, 40];

        const handDist = isDiamond ? 6 : 28;
        rig.wristL = [-handDist, floorY - 5, 40];
        rig.wristR = [handDist, floorY - 5, 40];

        rig.elbowL = [-handDist - 15 - (1 - t) * 10, 50 + dip * 0.5, 30];
        rig.elbowR = [handDist + 15 + (1 - t) * 10, 50 + dip * 0.5, 30];

        rig.hipL = [-14, 40 + dip * 0.5, -40]; rig.hipR = [14, 40 + dip * 0.5, -40];
        rig.kneeL = [-14, 65 + dip * 0.3, -80]; rig.kneeR = [14, 65 + dip * 0.3, -80];
        rig.ankleL = [-14, floorY - 5, -120]; rig.ankleR = [14, floorY - 5, -120];
        break;
      }

      case "deadlift": {
        rig.activeGroup = "back";
        const hinge = t * 65; // Hip hinge angle
        const barY = -5 + t * 90; // Bar moves from knees to floor

        rig.pelvis[1] += hinge * 0.45;
        rig.pelvis[2] -= hinge * 0.65;
        rig.waist[1] += hinge * 0.6;
        rig.waist[2] -= hinge * 0.45;
        rig.chest[1] += hinge * 0.8;
        rig.chest[2] -= hinge * 0.2;
        rig.neck[1] += hinge * 0.8;
        rig.head[1] += hinge * 0.8;

        rig.hipL[1] += hinge * 0.45; rig.hipL[2] -= hinge * 0.65;
        rig.hipR[1] += hinge * 0.45; rig.hipR[2] -= hinge * 0.65;
        rig.kneeL[1] += hinge * 0.15; rig.kneeL[2] += hinge * 0.15;
        rig.kneeR[1] += hinge * 0.15; rig.kneeR[2] += hinge * 0.15;

        // Arms reach down to grip bar
        rig.elbowL = [-24, barY - 35, 12];
        rig.elbowR = [24, barY - 35, 12];
        rig.wristL = [-24, barY, 12];
        rig.wristR = [24, barY, 12];

        barbell = {
          p1: [-65, barY, 12],
          p2: [65, barY, 12]
        };
        break;
      }

      case "bicep_curl": {
        rig.activeGroup = "biceps";
        // Standing strict curl
        const curlY = -10 - t * 75; // Hand curls up to shoulder
        const curlZ = 12 + t * 24;

        rig.elbowL = [-28, -45, 2];
        rig.elbowR = [28, -45, 2];
        rig.wristL = [-26, curlY, curlZ];
        rig.wristR = [26, curlY, curlZ];

        dumbbells = [
          [-26, curlY, curlZ],
          [26, curlY, curlZ]
        ];
        break;
      }

      case "overhead_press": {
        rig.activeGroup = "shoulders";
        const pressY = -75 - t * 80; // From clavicles to full lockout

        // Head clears bar path during press
        const headShiftZ = (1 - t) * 6;
        rig.head[2] -= headShiftZ;

        rig.elbowL = [-35 + t * 10, pressY + 45, 0];
        rig.elbowR = [35 - t * 10, pressY + 45, 0];
        rig.wristL = [-28, pressY, 0];
        rig.wristR = [28, pressY, 0];

        barbell = {
          p1: [-65, pressY, 0],
          p2: [65, pressY, 0]
        };
        break;
      }

      case "lunge": {
        rig.activeGroup = "quads";
        const drop = t * 50;

        rig.pelvis[1] += drop;
        rig.waist[1] += drop;
        rig.chest[1] += drop;
        rig.neck[1] += drop;
        rig.head[1] += drop;
        rig.hipL[1] += drop; rig.hipR[1] += drop;

        // Front leg (Right) steps forward
        rig.kneeR = [18, 45 + drop * 0.4, 40];
        rig.ankleR = [18, 105, 40];

        // Back leg (Left) drops to near floor
        rig.kneeL = [-18, 75 + drop * 0.6, -38];
        rig.ankleL = [-18, 105, -55];
        break;
      }

      case "lat_pulldown": {
        rig.activeGroup = "lats";
        // Seated with bar pulling down to upper chest
        const pullY = -135 + t * 65;

        rig.pelvis = [0, 20, 0];
        rig.hipL = [-18, 20, 0]; rig.hipR = [18, 20, 0];
        rig.kneeL = [-20, 55, 30]; rig.kneeR = [20, 55, 30];
        rig.ankleL = [-20, 105, 30]; rig.ankleR = [20, 105, 30];

        rig.waist = [0, -10, -5];
        rig.chest = [0, -45, -10]; // Slight backward lean
        rig.neck = [0, -68, -10];
        rig.head = [0, -90, -10];

        rig.elbowL = [-48 + t * 12, pullY + 35, -5];
        rig.elbowR = [48 - t * 12, pullY + 35, -5];
        rig.wristL = [-55 + t * 10, pullY, -8];
        rig.wristR = [55 - t * 10, pullY, -8];

        cableBar = {
          p1: [-75 + t * 10, pullY, -8],
          p2: [75 - t * 10, pullY, -8]
        };
        break;
      }

      case "bent_row": {
        rig.activeGroup = "back";
        // 45 degree torso inclination
        const pullY = -5 - t * 45; // Pull to waist

        rig.pelvis = [0, 0, -35];
        rig.waist = [0, -25, -18];
        rig.chest = [0, -52, 5];
        rig.neck = [0, -72, 18];
        rig.head = [0, -90, 28];

        rig.hipL = [-18, 0, -35]; rig.hipR = [18, 0, -35];
        rig.kneeL = [-19, 50, -10]; rig.kneeR = [19, 50, -10];
        rig.ankleL = [-18, 105, 0]; rig.ankleR = [18, 105, 0];

        rig.elbowL = [-34, pullY - 25, -15 - t * 15];
        rig.elbowR = [34, pullY - 25, -15 - t * 15];
        rig.wristL = [-26, pullY, 0];
        rig.wristR = [26, pullY, 0];

        barbell = {
          p1: [-65, pullY, 0],
          p2: [65, pullY, 0]
        };
        break;
      }

      case "tricep_dip": {
        rig.activeGroup = "triceps";
        const dip = t * 50;

        rig.pelvis[1] += dip;
        rig.waist[1] += dip;
        rig.chest[1] += dip;
        rig.neck[1] += dip;
        rig.head[1] += dip;

        // Knees bent back
        rig.kneeL = [-16, 35 + dip, -25]; rig.kneeR = [16, 35 + dip, -25];
        rig.ankleL = [-16, 25 + dip, -40]; rig.ankleR = [16, 25 + dip, -40];

        rig.wristL = [-35, -20, 0];
        rig.wristR = [35, -20, 0];
        rig.elbowL = [-38, -20 - dip * 0.7, -25];
        rig.elbowR = [38, -20 - dip * 0.7, -25];
        break;
      }

      case "tricep_pushdown": {
        rig.activeGroup = "triceps";
        // Cable bar pushed down from chest to hips
        const pushY = -35 + t * 65;

        rig.elbowL = [-25, -45, 0];
        rig.elbowR = [25, -45, 0];
        rig.wristL = [-20, pushY, 15];
        rig.wristR = [20, pushY, 15];

        cableBar = {
          p1: [-35, pushY, 15],
          p2: [35, pushY, 15]
        };
        break;
      }

      case "lateral_raise": {
        rig.activeGroup = "shoulders";
        // Dumbbells raise sideways to 90 degrees shoulder height
        const raiseAngle = (1 - t) * 75 * (Math.PI / 180);
        const armLen = 60;
        const armY = rig.shoulderL[1] + Math.cos(raiseAngle) * armLen;
        const armX = 28 + Math.sin(raiseAngle) * armLen;

        rig.elbowL = [-armX * 0.6, armY * 0.75, 4];
        rig.elbowR = [armX * 0.6, armY * 0.75, 4];
        rig.wristL = [-armX, armY, 4];
        rig.wristR = [armX, armY, 4];

        dumbbells = [
          [-armX, armY, 4],
          [armX, armY, 4]
        ];
        break;
      }

      case "plank": {
        rig.activeGroup = "core";
        // Completely flat isometric hold
        rig.head = [0, 45, 80];
        rig.neck = [0, 48, 65];
        rig.chest = [0, 52, 40];
        rig.waist = [0, 55, 0];
        rig.pelvis = [0, 58, -40];

        rig.shoulderL = [-20, 52, 40]; rig.shoulderR = [20, 52, 40];
        rig.elbowL = [-20, floorY - 5, 40]; rig.elbowR = [20, floorY - 5, 40];
        rig.wristL = [-14, floorY - 5, 60]; rig.wristR = [14, floorY - 5, 60];

        rig.hipL = [-14, 58, -40]; rig.hipR = [14, 58, -40];
        rig.kneeL = [-14, 75, -80]; rig.kneeR = [14, 75, -80];
        rig.ankleL = [-14, floorY - 5, -125]; rig.ankleR = [14, floorY - 5, -125];
        break;
      }

      case "calf_raise": {
        rig.activeGroup = "calves";
        const rise = t * 24; // Elevate onto toes
        rig.head[1] -= rise;
        rig.neck[1] -= rise;
        rig.chest[1] -= rise;
        rig.waist[1] -= rise;
        rig.pelvis[1] -= rise;
        rig.hipL[1] -= rise; rig.hipR[1] -= rise;
        rig.kneeL[1] -= rise; rig.kneeR[1] -= rise;
        rig.ankleL[1] -= rise; rig.ankleR[1] -= rise;
        break;
      }

      case "glute_bridge": {
        rig.activeGroup = "glutes";
        const bridge = t * 50; // Thrust hips up

        rig.head = [0, floorY - 12, -75];
        rig.neck = [0, floorY - 8, -55];
        rig.chest = [0, floorY - 5, -30];
        rig.waist = [0, floorY - 5 - bridge * 0.7, 0];
        rig.pelvis = [0, floorY - 5 - bridge, 30];

        rig.shoulderL = [-22, floorY - 6, -30]; rig.shoulderR = [22, floorY - 6, -30];
        rig.wristL = [-28, floorY - 4, -10]; rig.wristR = [28, floorY - 4, -10];

        rig.hipL = [-16, floorY - 5 - bridge, 30]; rig.hipR = [16, floorY - 5 - bridge, 30];
        rig.kneeL = [-20, floorY - 40 - bridge * 0.5, 65]; rig.kneeR = [20, floorY - 40 - bridge * 0.5, 65];
        rig.ankleL = [-20, floorY - 5, 60]; rig.ankleR = [20, floorY - 5, 60];
        break;
      }

      case "superman": {
        rig.activeGroup = "back";
        // Prone back extension
        const arch = t * 35;

        rig.head = [0, 65 - arch, 80];
        rig.chest = [0, 75 - arch * 0.5, 30];
        rig.waist = [0, 85, 0];
        rig.pelvis = [0, 85, -25];

        rig.wristL = [-25, 55 - arch * 1.2, 115];
        rig.wristR = [25, 55 - arch * 1.2, 115];

        rig.ankleL = [-15, 65 - arch * 0.8, -110];
        rig.ankleR = [15, 65 - arch * 0.8, -110];
        break;
      }

      case "bicycle_crunch": {
        rig.activeGroup = "core";
        const cycle = phase * Math.PI * 2;
        const twist = Math.sin(cycle) * 20;

        rig.chest = [twist, 55, 0];
        rig.head = [twist * 0.8, 35, 20];
        rig.pelvis = [0, 65, -30];

        const legPhase = Math.sin(cycle);
        rig.kneeL = [-18, 25 - legPhase * 25, 20 - legPhase * 35];
        rig.kneeR = [18, 25 + legPhase * 25, 20 + legPhase * 35];
        rig.elbowL = [-25 + twist, 35, 25];
        rig.elbowR = [25 + twist, 35, 25];
        break;
      }

      case "thruster": {
        // Compound: Squat down (phase 0 to 0.45) to Overhead Press (phase 0.55 to 1.0)
        rig.activeGroup = phase < 0.5 ? "quads" : "shoulders";
        if (phase < 0.5) {
          const subT = t; // Deep front squat
          const drop = subT * 60;
          rig.pelvis[1] += drop;
          rig.waist[1] += drop;
          rig.chest[1] += drop;
          rig.kneeL[1] += drop * 0.35; rig.kneeR[1] += drop * 0.35;
          rig.wristL = [-28, -60 + drop, 10];
          rig.wristR = [28, -60 + drop, 10];
          barbell = { p1: [-65, -60 + drop, 10], p2: [65, -60 + drop, 10] };
        } else {
          // Standing press overhead
          const pressT = (phase - 0.5) / 0.5;
          const pressY = -60 - pressT * 85;
          rig.wristL = [-28, pressY, 0];
          rig.wristR = [28, pressY, 0];
          barbell = { p1: [-65, pressY, 0], p2: [65, pressY, 0] };
        }
        break;
      }

      case "burpee": {
        rig.activeGroup = "full_body";
        // Phase 0-0.3 drop, 0.3-0.6 pushup, 0.6-0.8 tuck, 0.8-1.0 explosive vertical jump
        if (phase < 0.3) {
          rig.pelvis[1] += 60; rig.chest[1] += 60; rig.head[1] += 60;
        } else if (phase < 0.6) {
          rig.pelvis[1] = 60; rig.chest[1] = 50; rig.ankleL[2] = -90; rig.ankleR[2] = -90;
        } else if (phase < 0.8) {
          rig.pelvis[1] = 40; rig.chest[1] = 20;
        } else {
          const jump = Math.sin((phase - 0.8) / 0.2 * Math.PI) * 70;
          rig.head[1] -= jump; rig.chest[1] -= jump; rig.pelvis[1] -= jump;
          rig.ankleL[1] -= jump; rig.ankleR[1] -= jump;
          rig.wristL = [-25, rig.head[1] - 40, 0];
          rig.wristR = [25, rig.head[1] - 40, 0];
        }
        break;
      }

      case "cat_cow": {
        rig.activeGroup = "core";
        const catPhase = Math.sin(phase * Math.PI * 2);
        const spineCurve = catPhase * 30; // Cow arches down, Cat rounds up

        rig.head = [0, 20 + spineCurve * 0.5, 55];
        rig.neck = [0, 30 + spineCurve * 0.3, 40];
        rig.chest = [0, 35 - spineCurve * 0.6, 20];
        rig.waist = [0, 40 - spineCurve * 0.8, -5];
        rig.pelvis = [0, 45 + spineCurve * 0.4, -35];

        rig.wristL = [-22, floorY - 5, 30]; rig.wristR = [22, floorY - 5, 30];
        rig.kneeL = [-18, floorY - 5, -30]; rig.kneeR = [18, floorY - 5, -30];
        break;
      }

      case "walk":
      default: {
        rig.activeGroup = "calves";
        const stride = Math.sin(phase * Math.PI * 2);
        rig.ankleL = [-16, 105 - Math.max(0, stride * 22), stride * 35];
        rig.ankleR = [16, 105 - Math.max(0, -stride * 22), -stride * 35];
        rig.kneeL = [-17, 45, stride * 20];
        rig.kneeR = [17, 45, -stride * 20];

        rig.wristL = [-32, -10, -stride * 30];
        rig.wristR = [32, -10, stride * 30];
        break;
      }
    }

    // Project All 3D Nodes to Screen Space
    const proj = {};
    for (const [key, pt] of Object.entries(rig)) {
      if (Array.isArray(pt)) {
        proj[key] = this.project3D(pt, cx, cy);
      }
    }

    // Optional Gym Bench
    if (gymBench) {
      const bY = cy + gymBench.y;
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cx - 100, bY, 200, 16, 4);
      ctx.fill();
      ctx.stroke();

      // Bench legs
      ctx.fillStyle = "#334155";
      ctx.fillRect(cx - 85, bY + 16, 10, floorY - (bY + 16));
      ctx.fillRect(cx + 75, bY + 16, 10, floorY - (bY + 16));
    }

    // Depth Sorting for Muscular Limbs
    const leftArmZ = (proj.shoulderL.z + proj.wristL.z) / 2;
    const rightArmZ = (proj.shoulderR.z + proj.wristR.z) / 2;
    const leftLegZ = (proj.hipL.z + proj.ankleL.z) / 2;
    const rightLegZ = (proj.hipR.z + proj.ankleR.z) / 2;

    const isArmActive = rig.activeGroup === "biceps" || rig.activeGroup === "triceps" || rig.activeGroup === "shoulders";
    const isLegActive = rig.activeGroup === "quads" || rig.activeGroup === "calves" || rig.activeGroup === "glutes";

    // Draw Far Limbs First (Back to Front Z-Buffering)
    if (leftLegZ < rightLegZ) {
      this.drawMuscularLeg(ctx, proj.hipL, proj.kneeL, proj.ankleL, isLegActive);
      this.drawMuscularLeg(ctx, proj.hipR, proj.kneeR, proj.ankleR, isLegActive);
    } else {
      this.drawMuscularLeg(ctx, proj.hipR, proj.kneeR, proj.ankleR, isLegActive);
      this.drawMuscularLeg(ctx, proj.hipL, proj.kneeL, proj.ankleL, isLegActive);
    }

    // Draw Muscular Torso & Glutes
    this.drawMuscularTorso(ctx, proj.chest, proj.waist, proj.pelvis, rig.activeGroup);

    // Draw Muscular Head & Neck
    this.drawMuscularHead(ctx, proj.head, proj.neck);

    // Draw Deltoids (Shoulders)
    this.drawDeltoid(ctx, proj.shoulderL, rig.activeGroup === "shoulders");
    this.drawDeltoid(ctx, proj.shoulderR, rig.activeGroup === "shoulders");

    // Draw Fore Limbs (Z-Sorted)
    if (leftArmZ < rightArmZ) {
      this.drawMuscularArm(ctx, proj.shoulderL, proj.elbowL, proj.wristL, isArmActive);
      this.drawMuscularArm(ctx, proj.shoulderR, proj.elbowR, proj.wristR, isArmActive);
    } else {
      this.drawMuscularArm(ctx, proj.shoulderR, proj.elbowR, proj.wristR, isArmActive);
      this.drawMuscularArm(ctx, proj.shoulderL, proj.elbowL, proj.wristL, isArmActive);
    }

    // Draw Equipment (Barbell, Dumbbells, Cable Bar)
    if (barbell) {
      const p1 = this.project3D(barbell.p1, cx, cy);
      const p2 = this.project3D(barbell.p2, cx, cy);
      this.drawGymBarbell(ctx, p1, p2, 25);
    }

    if (dumbbells) {
      dumbbells.forEach(db => {
        const p = this.project3D(db, cx, cy);
        this.drawDumbbell(ctx, p, 24);
      });
    }

    if (cableBar) {
      const p1 = this.project3D(cableBar.p1, cx, cy);
      const p2 = this.project3D(cableBar.p2, cx, cy);
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4 * ((p1.scale + p2.scale) / 2);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      // Cable line to ceiling
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      ctx.lineTo((p1.x + p2.x) / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawMuscularArm(ctx, shoulder, elbow, wrist, active = false) {
    // Upper arm (Bicep & Tricep volume)
    this.drawMuscularLimb(ctx, shoulder, elbow, 11, 9, active, "bicep");
    // Forearm (Brachioradialis taper)
    this.drawMuscularLimb(ctx, elbow, wrist, 9, 6, active, "forearm");

    // Hand fist
    ctx.beginPath();
    ctx.arc(wrist.x, wrist.y, 6 * wrist.scale, 0, Math.PI * 2);
    ctx.fillStyle = active ? "#e11d48" : "#475569";
    ctx.fill();
  }

  drawMuscularLeg(ctx, hip, knee, ankle, active = false) {
    // Thigh (Quadriceps & Hamstrings volume)
    this.drawMuscularLimb(ctx, hip, knee, 16, 12, active, "quad");
    // Calf (Gastrocnemius double curve)
    this.drawMuscularLimb(ctx, knee, ankle, 12, 7, active, "calf");

    // Athletic foot shoe
    const scale = ankle.scale;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ankle.x, ankle.y + 2 * scale, 10 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

// Global modal launcher helper for application pages
let activeModelPlayer = null;

export function openExerciseDemoModal(workout) {
  const modal = document.getElementById("exercise-demo-modal");
  if (!modal) return;

  const titleEl = document.getElementById("demo-exercise-title");
  const bodyPartEl = document.getElementById("demo-exercise-bodypart");
  const equipEl = document.getElementById("demo-exercise-equipment");
  const muscleBadgeEl = document.getElementById("demo-muscle-badge");
  const lossBadgeEl = document.getElementById("demo-loss-badge");
  const formTipsEl = document.getElementById("demo-form-tips");
  const mistTipsEl = document.getElementById("demo-mistake-tip");

  if (titleEl) titleEl.textContent = workout.name;
  if (bodyPartEl) bodyPartEl.textContent = (workout.target_body_part || "Full Body").toUpperCase();
  if (equipEl) equipEl.textContent = (workout.workout_type || "Gym / Home").toUpperCase();

  if (muscleBadgeEl) {
    muscleBadgeEl.textContent = workout.sets_reps_muscle || "4 sets × 8-12 reps (Hypertrophy)";
  }
  if (lossBadgeEl) {
    lossBadgeEl.textContent = workout.sets_reps_loss || "3 sets × 15-20 reps (Fat Burn)";
  }

  if (formTipsEl && workout.steps) {
    formTipsEl.innerHTML = workout.steps.map((st) => `<li>${st}</li>`).join("");
  }

  if (mistTipsEl) {
    mistTipsEl.textContent = workout.description || "Maintain neutral spine and control both phases.";
  }

  // Initialize canvas player if needed
  if (!activeModelPlayer) {
    activeModelPlayer = new DummyModelPlayer("dummy-model-canvas");
    setupPlayerControls(activeModelPlayer);
  }

  activeModelPlayer.setWorkout(workout);
  activeModelPlayer.start();

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function setupPlayerControls(player) {
  const playBtn = document.getElementById("btn-demo-play");
  const speedBtn = document.getElementById("btn-demo-speed");
  const viewBtn = document.getElementById("btn-demo-view");
  const closeBtn = document.getElementById("btn-demo-close");
  const closeFooterBtn = document.getElementById("btn-demo-close-footer");
  const modal = document.getElementById("exercise-demo-modal");

  // Camera angle buttons
  const viewFrontBtn = document.getElementById("btn-view-front");
  const viewIsoBtn = document.getElementById("btn-view-iso");
  const viewSideBtn = document.getElementById("btn-view-side");
  const viewBackBtn = document.getElementById("btn-view-back");
  const viewSpinBtn = document.getElementById("btn-view-spin");

  if (viewFrontBtn) viewFrontBtn.addEventListener("click", () => player.setPresetView("front"));
  if (viewIsoBtn) viewIsoBtn.addEventListener("click", () => player.setPresetView("iso"));
  if (viewSideBtn) viewSideBtn.addEventListener("click", () => player.setPresetView("side"));
  if (viewBackBtn) viewBackBtn.addEventListener("click", () => player.setPresetView("back"));
  if (viewSpinBtn) viewSpinBtn.addEventListener("click", () => player.setPresetView("spin"));

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      const isPlay = player.togglePlay();
      playBtn.textContent = isPlay ? "⏸️ Pause" : "▶️ Play";
    });
  }

  if (speedBtn) {
    speedBtn.addEventListener("click", () => {
      if (player.speed === 1.0) {
        player.setSpeed(0.5);
        speedBtn.textContent = "0.5x Slow";
      } else if (player.speed === 0.5) {
        player.setSpeed(1.5);
        speedBtn.textContent = "1.5x Fast";
      } else {
        player.setSpeed(1.0);
        speedBtn.textContent = "1.0x Normal";
      }
    });
  }

  if (viewBtn) {
    viewBtn.addEventListener("click", () => {
      const mode = player.toggleView();
      viewBtn.textContent = `📐 ${mode}`;
    });
  }

  function closeModal() {
    if (modal) modal.classList.remove("active");
    document.body.style.overflow = "";
    if (player) player.stop();
  }

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
}
