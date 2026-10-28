/**
 * Biomechanical Dummy Model 2D Animation Engine
 * Renders an animated skeletal mannequin demonstrating form, biomechanics,
 * rep tempo, and muscle heatmap highlights on an HTML5 canvas.
 */

export class DummyModelPlayer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.animationFrameId = null;
    this.isPlaying = true;
    this.speed = 1.0;
    this.viewMode = "side"; // "side" or "front"
    this.repCount = 0;
    this.currentModel = "squat";
    this.startTime = performance.now();
    this.lastPhase = 0;
    this.activeWorkout = null;
  }

  setWorkout(workout) {
    this.activeWorkout = workout;
    this.currentModel = workout.demo_model || "squat";
    // Default best angle view based on exercise
    if (["bench_press", "squat", "deadlift", "pushup", "lunge", "plank", "bent_row", "tricep_dip", "glute_bridge", "superman", "cat_cow"].includes(this.currentModel)) {
      this.viewMode = "side";
    } else {
      this.viewMode = "front";
    }
    this.repCount = 0;
    this.lastPhase = 0;
    this.startTime = performance.now();
  }

  start() {
    if (!this.ctx) return;
    this.isPlaying = true;
    const animate = (timestamp) => {
      if (this.isPlaying) {
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

  toggleView() {
    this.viewMode = this.viewMode === "side" ? "front" : "side";
    return this.viewMode;
  }

  render(timestamp) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background Grid & Studio floor
    this.drawStudio(ctx, w, h);

    // Calculate normalized phase (0.0 to 1.0)
    // Full repetition takes ~3.6 seconds at 1.0x speed
    const baseDuration = 3600 / this.speed;
    const elapsed = timestamp - this.startTime;
    const rawPhase = (elapsed % baseDuration) / baseDuration;

    // Detect rep completion
    if (rawPhase < this.lastPhase && elapsed > 500) {
      this.repCount++;
      const repEl = document.getElementById("demo-rep-counter");
      if (repEl) repEl.textContent = this.repCount;
    }
    this.lastPhase = rawPhase;

    // Update tempo phase indicator in UI
    this.updateTempoUI(rawPhase);

    // Draw Biomechanical Mannequin based on exercise and view
    ctx.save();
    this.drawExerciseModel(ctx, w, h, rawPhase, this.currentModel, this.viewMode);
    ctx.restore();
  }

  drawStudio(ctx, w, h) {
    // Dark tech grid floor
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Floor line
    const floorY = h - 50;
    const grad = ctx.createLinearGradient(0, floorY, 0, h);
    grad.addColorStop(0, "rgba(56, 189, 248, 0.3)");
    grad.addColorStop(1, "rgba(15, 23, 42, 0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, floorY, w, 50);

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(w, floorY);
    ctx.stroke();
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
      tempoBadge.innerHTML = "⏸️ <strong>Isometric Pause:</strong> Peak contraction (1s)";
      tempoBadge.style.color = "#f59e0b";
    } else {
      tempoBadge.innerHTML = "⬆️ <strong>Concentric:</strong> Powerful drive up (2s)";
      tempoBadge.style.color = "#10b981";
    }
  }

  drawJoint(ctx, x, y, radius = 6, color = "#e2e8f0", glow = null) {
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawLimb(ctx, x1, y1, x2, y2, color = "#94a3b8", width = 7, muscleGlow = null) {
    if (muscleGlow) {
      ctx.shadowColor = muscleGlow;
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = muscleGlow || color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawExerciseModel(ctx, w, h, phase, model, view) {
    // Sinusoidal movement curve (0 at top, 1 at bottom, smooth turnaround)
    // 0 to 0.45 descends, 0.45 to 0.55 holds, 0.55 to 1.0 ascends
    let t;
    if (phase < 0.45) {
      t = 0.5 - 0.5 * Math.cos((phase / 0.45) * Math.PI);
    } else if (phase < 0.55) {
      t = 1.0;
    } else {
      t = 0.5 + 0.5 * Math.cos(((phase - 0.55) / 0.45) * Math.PI);
    }

    const cx = w / 2;
    const floorY = h - 50;

    switch (model) {
      case "squat":
        this.renderSquat(ctx, cx, floorY, t, view);
        break;
      case "bench_press":
        this.renderBenchPress(ctx, cx, floorY, t);
        break;
      case "pushup":
      case "diamond_pushup":
        this.renderPushup(ctx, cx, floorY, t, model === "diamond_pushup");
        break;
      case "deadlift":
        this.renderDeadlift(ctx, cx, floorY, t);
        break;
      case "bicep_curl":
      case "hammer_curl":
        this.renderBicepCurl(ctx, cx, floorY, t, view);
        break;
      case "overhead_press":
        this.renderOverheadPress(ctx, cx, floorY, t, view);
        break;
      case "lunge":
        this.renderLunge(ctx, cx, floorY, t);
        break;
      case "lat_pulldown":
        this.renderLatPulldown(ctx, cx, floorY, t);
        break;
      case "bent_row":
        this.renderBentRow(ctx, cx, floorY, t);
        break;
      case "tricep_dip":
        this.renderTricepDip(ctx, cx, floorY, t);
        break;
      case "tricep_pushdown":
        this.renderTricepPushdown(ctx, cx, floorY, t);
        break;
      case "lateral_raise":
        this.renderLateralRaise(ctx, cx, floorY, t);
        break;
      case "plank":
        this.renderPlank(ctx, cx, floorY, t);
        break;
      case "calf_raise":
        this.renderCalfRaise(ctx, cx, floorY, t);
        break;
      case "glute_bridge":
        this.renderGluteBridge(ctx, cx, floorY, t);
        break;
      case "superman":
        this.renderSuperman(ctx, cx, floorY, t);
        break;
      case "bicycle_crunch":
        this.renderBicycleCrunch(ctx, cx, floorY, phase);
        break;
      case "thruster":
        this.renderThruster(ctx, cx, floorY, phase);
        break;
      case "burpee":
        this.renderBurpee(ctx, cx, floorY, phase);
        break;
      case "cat_cow":
        this.renderCatCow(ctx, cx, floorY, phase);
        break;
      case "walk":
      default:
        this.renderWalk(ctx, cx, floorY, phase);
        break;
    }
  }

  // --- SQUAT ---
  renderSquat(ctx, cx, floorY, t, view) {
    const hipDrop = t * 65;
    const hipBack = t * 25;
    const kneeForward = t * 22;

    const footX = cx - 10;
    const footY = floorY;
    const kneeX = footX + kneeForward;
    const kneeY = floorY - 60 + hipDrop * 0.3;
    const hipX = cx - 15 - hipBack;
    const hipY = floorY - 120 + hipDrop;
    const shoulderX = cx - 5 - hipBack * 0.4;
    const shoulderY = hipY - 60;
    const headX = shoulderX + 5;
    const headY = shoulderY - 26;

    // Active muscles: Quads (bright amber) and Glutes (bright emerald)
    const quadGlow = t > 0.3 ? "#f59e0b" : "#94a3b8";
    const gluteGlow = t > 0.4 ? "#10b981" : "#94a3b8";

    // Legs
    this.drawLimb(ctx, footX, footY, kneeX, kneeY, "#cbd5e1", 8); // Shin
    this.drawLimb(ctx, kneeX, kneeY, hipX, hipY, quadGlow, 10, t > 0.3 ? "#f59e0b" : null); // Thigh / Quad

    // Torso / Glutes
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, gluteGlow, 12, t > 0.4 ? "#10b981" : null);

    // Arms holding barbell across shoulders
    const handX = shoulderX + 10;
    const handY = shoulderY - 5;
    this.drawLimb(ctx, shoulderX, shoulderY, shoulderX + 15, shoulderY + 25, "#94a3b8", 6);
    this.drawLimb(ctx, shoulderX + 15, shoulderY + 25, handX, handY, "#94a3b8", 6);

    // Barbell & plates
    this.drawBarbell(ctx, shoulderX - 5, shoulderY - 2, 70);

    // Head
    this.drawHead(ctx, headX, headY);

    // Joints
    this.drawJoint(ctx, footX, footY, 5);
    this.drawJoint(ctx, kneeX, kneeY, 6, "#38bdf8");
    this.drawJoint(ctx, hipX, hipY, 7, "#10b981");
    this.drawJoint(ctx, shoulderX, shoulderY, 6);
  }

  // --- BENCH PRESS ---
  renderBenchPress(ctx, cx, floorY, t) {
    const benchY = floorY - 65;
    const benchX1 = cx - 90;
    const benchX2 = cx + 90;

    // Draw gym bench
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(benchX1, benchY);
    ctx.lineTo(benchX2, benchY);
    ctx.stroke();

    // Bench pillars
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(benchX1 + 20, benchY);
    ctx.lineTo(benchX1 + 20, floorY);
    ctx.moveTo(benchX2 - 20, benchY);
    ctx.lineTo(benchX2 - 20, floorY);
    ctx.stroke();

    // Mannequin lying down
    const headX = cx - 50;
    const headY = benchY - 14;
    const shoulderX = cx - 25;
    const shoulderY = benchY - 8;
    const hipX = cx + 35;
    const hipY = benchY - 8;
    const kneeX = cx + 65;
    const kneeY = benchY + 15;
    const footX = cx + 70;
    const footY = floorY;

    // Torso
    const chestGlow = t > 0.3 ? "#10b981" : "#94a3b8";
    this.drawLimb(ctx, shoulderX, shoulderY, hipX, hipY, chestGlow, 14, t > 0.3 ? "#10b981" : null);

    // Legs to floor
    this.drawLimb(ctx, hipX, hipY, kneeX, kneeY, "#64748b", 8);
    this.drawLimb(ctx, kneeX, kneeY, footX, footY, "#64748b", 8);
    this.drawJoint(ctx, footX, footY, 5);
    this.drawJoint(ctx, kneeX, kneeY, 5);

    // Arms pressing bar
    // At t=0 (lockout): bar high. At t=1 (bottom): bar touches chest
    const barHeight = benchY - 60 + t * 45;
    const barX = shoulderX + 5;
    const elbowX = shoulderX - 10 + t * 15;
    const elbowY = benchY - 20 + t * 25;

    const tricepGlow = t > 0.2 ? "#38bdf8" : "#94a3b8";
    this.drawLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, tricepGlow, 8, t > 0.2 ? "#38bdf8" : null);
    this.drawLimb(ctx, elbowX, elbowY, barX, barHeight, "#cbd5e1", 7);

    // Barbell
    this.drawBarbell(ctx, barX, barHeight, 70);

    // Head
    this.drawHead(ctx, headX, headY);
    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, elbowX, elbowY, 5);
    this.drawJoint(ctx, barX, barHeight, 5);
  }

  // --- PUSH-UP & DIAMOND PUSH-UP ---
  renderPushup(ctx, cx, floorY, t, isDiamond = false) {
    const toeX = cx - 90;
    const toeY = floorY - 8;
    const drop = t * 38;

    const hipX = cx - 25;
    const hipY = floorY - 55 + drop * 0.7;
    const shoulderX = cx + 45;
    const shoulderY = floorY - 65 + drop;
    const headX = shoulderX + 22;
    const headY = shoulderY - 8;

    const handX = isDiamond ? shoulderX - 5 : shoulderX + 5;
    const handY = floorY - 5;
    const elbowX = shoulderX - 15 - (isDiamond ? 5 : 0);
    const elbowY = shoulderY + (isDiamond ? 10 : 15);

    // Mat
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 110, floorY - 3);
    ctx.lineTo(cx + 90, floorY - 3);
    ctx.stroke();

    // Body plank line (rigid hollow body)
    const chestGlow = t > 0.3 ? "#10b981" : "#94a3b8";
    const tricepGlow = t > 0.3 ? (isDiamond ? "#f59e0b" : "#38bdf8") : "#94a3b8";

    this.drawLimb(ctx, toeX, toeY, hipX, hipY, "#64748b", 9);
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, chestGlow, 12, t > 0.3 ? "#10b981" : null);

    // Arm
    this.drawLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, tricepGlow, 8, tricepGlow !== "#94a3b8" ? tricepGlow : null);
    this.drawLimb(ctx, elbowX, elbowY, handX, handY, "#cbd5e1", 7);

    // Head
    this.drawHead(ctx, headX, headY);
    this.drawJoint(ctx, toeX, toeY, 5);
    this.drawJoint(ctx, hipX, hipY, 6);
    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, elbowX, elbowY, 5);
    this.drawJoint(ctx, handX, handY, 5);
  }

  // --- DEADLIFT ---
  renderDeadlift(ctx, cx, floorY, t) {
    // t=0 standing tall, t=1 deep hip hinge with barbell at floor
    const hinge = t;
    const hipX = cx - 10 - hinge * 32;
    const hipY = floorY - 115 + hinge * 35;
    const shoulderX = cx + 15 - hinge * 20;
    const shoulderY = floorY - 180 + hinge * 85;
    const headX = shoulderX + 12 - hinge * 5;
    const headY = shoulderY - 24;

    const footX = cx + 10;
    const footY = floorY;
    const kneeX = footX - hinge * 12;
    const kneeY = floorY - 55 + hinge * 12;

    const barX = footX + 2;
    const barY = floorY - 95 + hinge * 82;

    const backGlow = t > 0.3 ? "#10b981" : "#94a3b8";
    const hamGlow = t > 0.3 ? "#f59e0b" : "#94a3b8";

    // Legs
    this.drawLimb(ctx, footX, footY, kneeX, kneeY, "#64748b", 8);
    this.drawLimb(ctx, kneeX, kneeY, hipX, hipY, hamGlow, 10, hamGlow !== "#94a3b8" ? hamGlow : null);

    // Torso
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, backGlow, 13, backGlow !== "#94a3b8" ? backGlow : null);

    // Arms hanging straight down to bar
    this.drawLimb(ctx, shoulderX, shoulderY, barX, barY, "#cbd5e1", 7);

    // Barbell & 45lb plates
    this.drawBarbell(ctx, barX, barY, 65, true);

    this.drawHead(ctx, headX, headY);
    this.drawJoint(ctx, footX, footY, 5);
    this.drawJoint(ctx, kneeX, kneeY, 6);
    this.drawJoint(ctx, hipX, hipY, 7);
    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, barX, barY, 5);
  }

  // --- BICEP CURL ---
  renderBicepCurl(ctx, cx, floorY, t, view) {
    const headX = cx;
    const headY = floorY - 185;
    const neckY = headY + 18;
    const hipY = floorY - 100;
    const shoulderX = cx - 22;
    const shoulderY = neckY + 12;

    // Body
    this.drawHead(ctx, headX, headY);
    this.drawLimb(ctx, headX, neckY, cx, hipY, "#64748b", 12);
    this.drawLimb(ctx, cx, hipY, cx - 15, floorY, "#475569", 9);
    this.drawLimb(ctx, cx, hipY, cx + 15, floorY, "#475569", 9);

    // Bicep curl arm: shoulder -> pinned elbow -> curled wrist
    const elbowX = shoulderX - 2;
    const elbowY = shoulderY + 45;

    // Curl angle: t=0 extended down (wrist below elbow), t=1 contracted up (wrist at shoulder)
    const curlAngle = 0.2 + t * 2.3;
    const wristX = elbowX + Math.sin(curlAngle) * 40;
    const wristY = elbowY + Math.cos(curlAngle) * 40;

    const bicepGlow = t > 0.3 ? "#10b981" : "#94a3b8";

    // Upper arm (biceps)
    this.drawLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, bicepGlow, 10, bicepGlow !== "#94a3b8" ? bicepGlow : null);
    // Forearm
    this.drawLimb(ctx, elbowX, elbowY, wristX, wristY, "#cbd5e1", 7);

    // Dumbbell in hand
    this.drawDumbbell(ctx, wristX, wristY, 26);

    // Joints
    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, elbowX, elbowY, 6, "#38bdf8");
    this.drawJoint(ctx, wristX, wristY, 5);
  }

  // --- OVERHEAD PRESS ---
  renderOverheadPress(ctx, cx, floorY, t, view) {
    const headX = cx;
    const headY = floorY - 185;
    const shoulderY = floorY - 155;
    const hipY = floorY - 95;

    // Body
    this.drawHead(ctx, headX, headY);
    this.drawLimb(ctx, headX, headY + 15, cx, hipY, "#64748b", 12);
    this.drawLimb(ctx, cx, hipY, cx - 18, floorY, "#475569", 9);
    this.drawLimb(ctx, cx, hipY, cx + 18, floorY, "#475569", 9);

    // Overhead Press: t=0 barbell at collarbones, t=1 locked overhead
    // Lift from collarbone (shoulderY) to overhead (headY - 55)
    const barY = shoulderY - t * 75;
    const barX = cx;

    const deltGlow = t > 0.2 ? "#10b981" : "#94a3b8";

    // Left & Right Arms
    const leftElbowX = cx - 35 + t * 12;
    const leftElbowY = shoulderY + 25 - t * 45;
    const rightElbowX = cx + 35 - t * 12;
    const rightElbowY = shoulderY + 25 - t * 45;

    this.drawLimb(ctx, cx - 20, shoulderY, leftElbowX, leftElbowY, deltGlow, 8, deltGlow !== "#94a3b8" ? deltGlow : null);
    this.drawLimb(ctx, leftElbowX, leftElbowY, cx - 28, barY, "#cbd5e1", 7);

    this.drawLimb(ctx, cx + 20, shoulderY, rightElbowX, rightElbowY, deltGlow, 8, deltGlow !== "#94a3b8" ? deltGlow : null);
    this.drawLimb(ctx, rightElbowX, rightElbowY, cx + 28, barY, "#cbd5e1", 7);

    // Barbell
    this.drawBarbell(ctx, barX, barY, 80);

    this.drawJoint(ctx, cx - 20, shoulderY, 6);
    this.drawJoint(ctx, cx + 20, shoulderY, 6);
    this.drawJoint(ctx, leftElbowX, leftElbowY, 5);
    this.drawJoint(ctx, rightElbowX, rightElbowY, 5);
  }

  // --- LUNGE ---
  renderLunge(ctx, cx, floorY, t) {
    const lungeDepth = t * 42;
    const frontFootX = cx + 45;
    const frontFootY = floorY;
    const backToeX = cx - 65;
    const backToeY = floorY;

    const frontKneeX = frontFootX - 5;
    const frontKneeY = floorY - 55 + lungeDepth * 0.4;

    const backKneeX = backToeX + 25;
    const backKneeY = floorY - 55 + lungeDepth;

    const hipX = cx - 5;
    const hipY = floorY - 110 + lungeDepth;
    const shoulderX = hipX - 2;
    const shoulderY = hipY - 60;
    const headX = shoulderX;
    const headY = shoulderY - 26;

    const quadGlow = t > 0.3 ? "#f59e0b" : "#94a3b8";
    const gluteGlow = t > 0.3 ? "#10b981" : "#94a3b8";

    // Front Leg
    this.drawLimb(ctx, frontFootX, frontFootY, frontKneeX, frontKneeY, "#64748b", 8);
    this.drawLimb(ctx, frontKneeX, frontKneeY, hipX, hipY, quadGlow, 10, quadGlow !== "#94a3b8" ? quadGlow : null);

    // Back Leg
    this.drawLimb(ctx, backToeX, backToeY, backKneeX, backKneeY, "#64748b", 8);
    this.drawLimb(ctx, backKneeX, backKneeY, hipX, hipY, gluteGlow, 10, gluteGlow !== "#94a3b8" ? gluteGlow : null);

    // Torso & Head
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, "#94a3b8", 12);
    this.drawHead(ctx, headX, headY);

    // Arms with dumbbells
    this.drawLimb(ctx, shoulderX, shoulderY, shoulderX, shoulderY + 45, "#cbd5e1", 6);
    this.drawDumbbell(ctx, shoulderX, shoulderY + 45, 24);

    this.drawJoint(ctx, frontFootX, frontFootY, 5);
    this.drawJoint(ctx, backToeX, backToeY, 5);
    this.drawJoint(ctx, frontKneeX, frontKneeY, 6);
    this.drawJoint(ctx, backKneeX, backKneeY, 6);
    this.drawJoint(ctx, hipX, hipY, 7);
  }

  // --- LAT PULLDOWN ---
  renderLatPulldown(ctx, cx, floorY, t) {
    const seatY = floorY - 50;
    // Seat
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - 30, seatY);
    ctx.lineTo(cx + 30, seatY);
    ctx.stroke();

    const hipX = cx;
    const hipY = seatY - 5;
    const shoulderX = cx - 8;
    const shoulderY = hipY - 65;
    const headX = shoulderX;
    const headY = shoulderY - 25;

    // Lat pulldown bar: t=0 high bar (extended), t=1 bar pulled to chin
    const barY = shoulderY - 75 + t * 65;
    const barX = shoulderX + 15;

    const latGlow = t > 0.3 ? "#10b981" : "#94a3b8";

    // Legs on floor
    this.drawLimb(ctx, hipX, hipY, cx + 25, seatY + 15, "#64748b", 8);
    this.drawLimb(ctx, cx + 25, seatY + 15, cx + 30, floorY, "#64748b", 8);

    // Torso / Lats
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, latGlow, 13, latGlow !== "#94a3b8" ? latGlow : null);
    this.drawHead(ctx, headX, headY);

    // Arms pulling cable bar
    const elbowX = shoulderX + 5 - t * 15;
    const elbowY = shoulderY - 15 + t * 45;

    this.drawLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, latGlow, 8);
    this.drawLimb(ctx, elbowX, elbowY, barX, barY, "#cbd5e1", 7);

    // Pulldown bar & cable
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, 0);
    ctx.lineTo(barX, barY);
    ctx.stroke();

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(barX - 45, barY);
    ctx.lineTo(barX + 45, barY);
    ctx.stroke();

    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, elbowX, elbowY, 5);
    this.drawJoint(ctx, barX, barY, 5);
  }

  // --- BENT ROW ---
  renderBentRow(ctx, cx, floorY, t) {
    const hipX = cx - 35;
    const hipY = floorY - 95;
    const shoulderX = cx + 15;
    const shoulderY = floorY - 140;
    const headX = shoulderX + 15;
    const headY = shoulderY - 15;

    const footX = cx - 10;
    const footY = floorY;
    const kneeX = cx - 15;
    const kneeY = floorY - 50;

    // Barbell: t=0 arms hanging low, t=1 pulled to belly button
    const barX = cx;
    const barY = floorY - 75 - t * 45;
    const elbowX = shoulderX - 10 - t * 20;
    const elbowY = shoulderY + 25 - t * 25;

    const latGlow = t > 0.3 ? "#10b981" : "#94a3b8";

    // Legs
    this.drawLimb(ctx, footX, footY, kneeX, kneeY, "#64748b", 8);
    this.drawLimb(ctx, kneeX, kneeY, hipX, hipY, "#64748b", 10);

    // Torso (45-degree flat hinge)
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, latGlow, 13, latGlow !== "#94a3b8" ? latGlow : null);
    this.drawHead(ctx, headX, headY);

    // Arm pulling bar
    this.drawLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, latGlow, 8);
    this.drawLimb(ctx, elbowX, elbowY, barX, barY, "#cbd5e1", 7);

    // Barbell
    this.drawBarbell(ctx, barX, barY, 60);

    this.drawJoint(ctx, hipX, hipY, 7);
    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, elbowX, elbowY, 5);
  }

  // --- TRICEP DIP ---
  renderTricepDip(ctx, cx, floorY, t) {
    const chairX = cx - 45;
    const chairY = floorY - 60;

    // Chair/Bench
    ctx.fillStyle = "#334155";
    ctx.fillRect(chairX - 35, chairY, 40, 10);
    ctx.fillRect(chairX - 30, chairY + 10, 8, floorY - chairY - 10);

    const dipDepth = t * 35;
    const handX = chairX - 5;
    const handY = chairY;

    const shoulderX = chairX + 10;
    const shoulderY = chairY - 35 + dipDepth;
    const elbowX = chairX - 25;
    const elbowY = shoulderY + 15;

    const hipX = chairX + 15;
    const hipY = chairY + dipDepth;
    const footX = cx + 60;
    const footY = floorY;

    const tricepGlow = t > 0.3 ? "#38bdf8" : "#94a3b8";

    // Legs extended
    this.drawLimb(ctx, hipX, hipY, footX, footY, "#64748b", 8);

    // Torso
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, "#94a3b8", 12);
    this.drawHead(ctx, shoulderX, shoulderY - 24);

    // Tricep arms
    this.drawLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, tricepGlow, 8, tricepGlow !== "#94a3b8" ? tricepGlow : null);
    this.drawLimb(ctx, elbowX, elbowY, handX, handY, "#cbd5e1", 7);

    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, elbowX, elbowY, 6);
    this.drawJoint(ctx, handX, handY, 5);
  }

  // --- TRICEP PUSHDOWN ---
  renderTricepPushdown(ctx, cx, floorY, t) {
    const headX = cx - 10;
    const headY = floorY - 180;
    const shoulderX = cx - 10;
    const shoulderY = headY + 28;
    const hipY = floorY - 95;

    // Body with slight forward lean
    this.drawHead(ctx, headX, headY);
    this.drawLimb(ctx, headX, headY + 15, cx - 5, hipY, "#64748b", 12);
    this.drawLimb(ctx, cx - 5, hipY, cx - 18, floorY, "#475569", 9);
    this.drawLimb(ctx, cx - 5, hipY, cx + 15, floorY, "#475569", 9);

    // Cable Pulley line from top
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 35, 0);
    ctx.lineTo(cx + 25, shoulderY);
    ctx.stroke();

    // Pinned elbow, extending downward
    const elbowX = shoulderX + 12;
    const elbowY = shoulderY + 30;

    // t=0 elbow bent 90 deg, t=1 locked straight down
    const angle = 1.3 - t * 1.3;
    const handX = elbowX + Math.sin(angle) * 40;
    const handY = elbowY + Math.cos(angle) * 40;

    const tricepGlow = t > 0.3 ? "#38bdf8" : "#94a3b8";

    this.drawLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, "#94a3b8", 8);
    this.drawLimb(ctx, elbowX, elbowY, handX, handY, tricepGlow, 8, tricepGlow !== "#94a3b8" ? tricepGlow : null);

    // Cable rope handles
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(handX - 8, handY);
    ctx.lineTo(handX + 8, handY);
    ctx.stroke();

    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, elbowX, elbowY, 6);
    this.drawJoint(ctx, handX, handY, 5);
  }

  // --- LATERAL RAISE ---
  renderLateralRaise(ctx, cx, floorY, t) {
    const headX = cx;
    const headY = floorY - 185;
    const shoulderY = floorY - 155;
    const hipY = floorY - 95;

    this.drawHead(ctx, headX, headY);
    this.drawLimb(ctx, headX, headY + 15, cx, hipY, "#64748b", 12);
    this.drawLimb(ctx, cx, hipY, cx - 16, floorY, "#475569", 9);
    this.drawLimb(ctx, cx, hipY, cx + 16, floorY, "#475569", 9);

    // Dumbbell raises from sides to parallel T-shape
    const raiseAngle = 0.2 + t * 1.35;
    const leftArmX = cx - 20 - Math.sin(raiseAngle) * 55;
    const leftArmY = shoulderY + Math.cos(raiseAngle) * 55;

    const rightArmX = cx + 20 + Math.sin(raiseAngle) * 55;
    const rightArmY = shoulderY + Math.cos(raiseAngle) * 55;

    const deltGlow = t > 0.3 ? "#10b981" : "#94a3b8";

    this.drawLimb(ctx, cx - 20, shoulderY, leftArmX, leftArmY, deltGlow, 8, deltGlow !== "#94a3b8" ? deltGlow : null);
    this.drawLimb(ctx, cx + 20, shoulderY, rightArmX, rightArmY, deltGlow, 8, deltGlow !== "#94a3b8" ? deltGlow : null);

    this.drawDumbbell(ctx, leftArmX, leftArmY, 22);
    this.drawDumbbell(ctx, rightArmX, rightArmY, 22);

    this.drawJoint(ctx, cx - 20, shoulderY, 6);
    this.drawJoint(ctx, cx + 20, shoulderY, 6);
  }

  // --- PLANK ---
  renderPlank(ctx, cx, floorY, t) {
    const toeX = cx - 95;
    const toeY = floorY - 8;
    const elbowX = cx + 45;
    const elbowY = floorY - 8;
    const handX = elbowX + 25;
    const handY = floorY - 8;

    const shoulderX = elbowX;
    const shoulderY = floorY - 48;
    const hipX = cx - 25;
    const hipY = floorY - 45 + Math.sin(t * Math.PI * 2) * 2; // subtle breathing pulse
    const headX = shoulderX + 22;
    const headY = shoulderY - 5;

    // Mat
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 110, floorY - 3);
    ctx.lineTo(cx + 90, floorY - 3);
    ctx.stroke();

    // Core glow (emerald pulsing)
    const coreGlow = "#10b981";

    this.drawLimb(ctx, toeX, toeY, hipX, hipY, "#64748b", 9);
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, coreGlow, 14, coreGlow);
    this.drawLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, "#cbd5e1", 8);
    this.drawLimb(ctx, elbowX, elbowY, handX, handY, "#cbd5e1", 6);

    this.drawHead(ctx, headX, headY);
    this.drawJoint(ctx, toeX, toeY, 5);
    this.drawJoint(ctx, hipX, hipY, 7, "#10b981");
    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, elbowX, elbowY, 6);
  }

  // --- CALF RAISE ---
  renderCalfRaise(ctx, cx, floorY, t) {
    const raiseHeight = t * 24;
    const footX = cx;
    const footY = floorY - raiseHeight;
    const kneeY = footY - 70;
    const hipY = footY - 140;
    const shoulderY = hipY - 60;
    const headY = shoulderY - 25;

    const calfGlow = t > 0.3 ? "#10b981" : "#94a3b8";

    this.drawHead(ctx, cx, headY);
    this.drawLimb(ctx, cx, shoulderY, cx, hipY, "#64748b", 12);
    this.drawLimb(ctx, cx, hipY, cx, kneeY, "#64748b", 10);
    this.drawLimb(ctx, cx, kneeY, footX, footY, calfGlow, 9, calfGlow !== "#94a3b8" ? calfGlow : null);

    // Ball of foot pivot
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 15, floorY);
    ctx.lineTo(cx + 15, floorY);
    ctx.stroke();

    this.drawJoint(ctx, footX, footY, 6, calfGlow);
    this.drawJoint(ctx, cx, kneeY, 6);
    this.drawJoint(ctx, cx, hipY, 6);
  }

  // --- GLUTE BRIDGE ---
  renderGluteBridge(ctx, cx, floorY, t) {
    const headX = cx - 75;
    const headY = floorY - 12;
    const shoulderX = cx - 55;
    const shoulderY = floorY - 10;
    const footX = cx + 55;
    const footY = floorY - 5;

    // Thrust height: t=0 hip on floor, t=1 hip thrust high
    const hipX = cx - 5;
    const hipY = floorY - 15 - t * 50;
    const kneeX = cx + 35;
    const kneeY = floorY - 55;

    const gluteGlow = t > 0.3 ? "#10b981" : "#94a3b8";

    // Torso to thrusting hips
    this.drawLimb(ctx, shoulderX, shoulderY, hipX, hipY, gluteGlow, 14, gluteGlow !== "#94a3b8" ? gluteGlow : null);
    // Thighs
    this.drawLimb(ctx, hipX, hipY, kneeX, kneeY, gluteGlow, 11, gluteGlow !== "#94a3b8" ? gluteGlow : null);
    // Shins
    this.drawLimb(ctx, kneeX, kneeY, footX, footY, "#64748b", 8);

    this.drawHead(ctx, headX, headY);
    this.drawJoint(ctx, footX, footY, 5);
    this.drawJoint(ctx, kneeX, kneeY, 6);
    this.drawJoint(ctx, hipX, hipY, 7, gluteGlow);
  }

  // --- SUPERMAN ---
  renderSuperman(ctx, cx, floorY, t) {
    const lift = t * 25;
    const hipX = cx;
    const hipY = floorY - 10;
    const shoulderX = cx + 45;
    const shoulderY = floorY - 15 - lift;
    const headX = shoulderX + 20;
    const headY = shoulderY - 8;
    const handX = headX + 35;
    const handY = headY - 10;

    const kneeX = cx - 40;
    const kneeY = floorY - 12 - lift * 0.8;
    const footX = cx - 75;
    const footY = floorY - 15 - lift;

    const backGlow = t > 0.3 ? "#10b981" : "#94a3b8";

    // Torso arch
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, backGlow, 12, backGlow !== "#94a3b8" ? backGlow : null);
    this.drawLimb(ctx, shoulderX, shoulderY, handX, handY, "#cbd5e1", 7);

    // Legs lift
    this.drawLimb(ctx, hipX, hipY, kneeX, kneeY, backGlow, 10);
    this.drawLimb(ctx, kneeX, kneeY, footX, footY, "#64748b", 8);

    this.drawHead(ctx, headX, headY);
    this.drawJoint(ctx, hipX, hipY, 7);
  }

  // --- BICYCLE CRUNCH ---
  renderBicycleCrunch(ctx, cx, floorY, phase) {
    const cycle = Math.sin(phase * Math.PI * 2);
    const shoulderX = cx - 40;
    const shoulderY = floorY - 35;
    const hipX = cx;
    const hipY = floorY - 15;
    const headX = shoulderX - 18;
    const headY = shoulderY - 15;

    // Alternating cycling knees
    const leftKneeX = cx + 20 + cycle * 25;
    const leftKneeY = floorY - 45 - cycle * 10;
    const rightKneeX = cx + 55 - cycle * 25;
    const rightKneeY = floorY - 25 + cycle * 10;

    const coreGlow = "#10b981";

    this.drawHead(ctx, headX, headY);
    this.drawLimb(ctx, shoulderX, shoulderY, hipX, hipY, coreGlow, 13, coreGlow);
    this.drawLimb(ctx, hipX, hipY, leftKneeX, leftKneeY, "#38bdf8", 8);
    this.drawLimb(ctx, hipX, hipY, rightKneeX, rightKneeY, "#64748b", 8);

    // Elbow reaches toward opposite knee
    this.drawLimb(ctx, shoulderX, shoulderY, cx + cycle * 15, floorY - 45, "#cbd5e1", 7);
  }

  // --- THRUSTER ---
  renderThruster(ctx, cx, floorY, phase) {
    // 0 to 0.5: squat down and up; 0.5 to 1.0: press overhead
    let tSquat = 0;
    let tPress = 0;
    if (phase < 0.5) {
      tSquat = Math.sin((phase / 0.5) * Math.PI);
    } else {
      tPress = Math.sin(((phase - 0.5) / 0.5) * Math.PI);
    }

    const hipDrop = tSquat * 60;
    const pressHeight = tPress * 75;

    const hipX = cx - 15;
    const hipY = floorY - 110 + hipDrop;
    const shoulderX = cx - 5;
    const shoulderY = hipY - 55;
    const barY = shoulderY - pressHeight;

    const glow = phase > 0.5 ? "#38bdf8" : "#f59e0b";

    this.drawLimb(ctx, cx, floorY, cx + tSquat * 15, floorY - 55 + hipDrop * 0.4, "#64748b", 8);
    this.drawLimb(ctx, cx + tSquat * 15, floorY - 55 + hipDrop * 0.4, hipX, hipY, glow, 10, glow);
    this.drawLimb(ctx, hipX, hipY, shoulderX, shoulderY, glow, 12, glow);

    this.drawHead(ctx, shoulderX + 5, shoulderY - 25);
    this.drawBarbell(ctx, shoulderX + 10, barY, 70);
  }

  // --- BURPEE ---
  renderBurpee(ctx, cx, floorY, phase) {
    if (phase < 0.25) {
      // Standing to squat jump
      this.renderSquat(ctx, cx, floorY, phase / 0.25, "side");
    } else if (phase < 0.75) {
      // Horizontal pushup
      const pushPhase = (phase - 0.25) / 0.5;
      this.renderPushup(ctx, cx, floorY, Math.sin(pushPhase * Math.PI));
    } else {
      // Jump up
      const jumpPhase = (phase - 0.75) / 0.25;
      const jumpY = Math.sin(jumpPhase * Math.PI) * 45;
      this.renderCalfRaise(ctx, cx, floorY - jumpY, 1.0);
    }
  }

  // --- CAT COW ---
  renderCatCow(ctx, cx, floorY, phase) {
    const cycle = Math.sin(phase * Math.PI * 2); // -1 to +1
    const handX = cx + 45;
    const handY = floorY - 5;
    const kneeX = cx - 45;
    const kneeY = floorY - 5;

    const shoulderX = handX;
    const shoulderY = floorY - 60;
    const hipX = kneeX;
    const hipY = floorY - 60;

    // Spine arches down (Cow: cycle > 0) or domes up (Cat: cycle < 0)
    const midSpineX = cx;
    const midSpineY = floorY - 60 - cycle * 18;

    const headX = handX + 18;
    const headY = shoulderY - (cycle > 0 ? 15 : -10);

    const mobilityGlow = "#38bdf8";

    // Quadruped limbs
    this.drawLimb(ctx, handX, handY, shoulderX, shoulderY, "#64748b", 8);
    this.drawLimb(ctx, kneeX, kneeY, hipX, hipY, "#64748b", 8);

    // Spine curve
    ctx.strokeStyle = mobilityGlow;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(midSpineX, midSpineY, shoulderX, shoulderY);
    ctx.stroke();

    this.drawHead(ctx, headX, headY);
    this.drawJoint(ctx, shoulderX, shoulderY, 6);
    this.drawJoint(ctx, hipX, hipY, 6);
  }

  // --- WALK / CARDIO ---
  renderWalk(ctx, cx, floorY, phase) {
    const stride = Math.sin(phase * Math.PI * 2);
    const headX = cx;
    const headY = floorY - 180 + Math.abs(stride) * 4;
    const shoulderY = headY + 28;
    const hipY = floorY - 95 + Math.abs(stride) * 3;

    // Opposing arm and leg swings
    const leftFootX = cx + stride * 35;
    const rightFootX = cx - stride * 35;

    const leftHandX = cx - stride * 28;
    const rightHandX = cx + stride * 28;

    this.drawHead(ctx, headX, headY);
    this.drawLimb(ctx, headX, headY + 15, cx, hipY, "#64748b", 12);

    // Legs
    this.drawLimb(ctx, cx, hipY, leftFootX, floorY, "#38bdf8", 9);
    this.drawLimb(ctx, cx, hipY, rightFootX, floorY, "#94a3b8", 9);

    // Arms
    this.drawLimb(ctx, cx - 15, shoulderY, leftHandX, shoulderY + 40, "#cbd5e1", 7);
    this.drawLimb(ctx, cx + 15, shoulderY, rightHandX, shoulderY + 40, "#cbd5e1", 7);
  }

  // --- APPARATUS DRAWING HELPERS ---
  drawHead(ctx, x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#e2e8f0";
    ctx.fill();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eye visor line (direction of gaze)
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + 2, y, 12, -0.4, 0.4);
    ctx.stroke();
  }

  drawBarbell(ctx, x, y, width = 70, bigPlates = false) {
    // Steel bar
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, y);
    ctx.lineTo(x + width / 2, y);
    ctx.stroke();

    // Olympic Plates
    const plateRadius = bigPlates ? 22 : 16;
    ctx.fillStyle = "#ef4444"; // Red 45lb/20kg bumper plate
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;

    // Left plate
    ctx.beginPath();
    ctx.roundRect(x - width / 2 - 4, y - plateRadius, 8, plateRadius * 2, 3);
    ctx.fill();
    ctx.stroke();

    // Right plate
    ctx.beginPath();
    ctx.roundRect(x + width / 2 - 4, y - plateRadius, 8, plateRadius * 2, 3);
    ctx.fill();
    ctx.stroke();
  }

  drawDumbbell(ctx, x, y, length = 24) {
    // Handle
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - length / 2, y);
    ctx.lineTo(x + length / 2, y);
    ctx.stroke();

    // Hex heads
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.roundRect(x - length / 2 - 4, y - 9, 7, 18, 2);
    ctx.roundRect(x + length / 2 - 3, y - 9, 7, 18, 2);
    ctx.fill();
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
  const modal = document.getElementById("exercise-demo-modal");

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
      viewBtn.textContent = mode === "side" ? "📐 Side View" : "👤 Front View";
    });
  }

  function closeModal() {
    if (modal) modal.classList.remove("active");
    document.body.style.overflow = "";
    if (player) player.stop();
  }

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
}
