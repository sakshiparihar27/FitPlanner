/* FitPlanner (vanilla JS) */

const STORAGE_KEY = "fitplanner:v1";
const THEME_KEY = "fitplanner:theme";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => el.classList.remove("show"), 2200);
}

function setStatus(msg) {
  const el = $("#statusText");
  if (el) el.textContent = msg || "";
}

function getThemePreference() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const icon = $("#themeToggle .icon");
  if (icon) icon.dataset.icon = theme === "dark" ? "moon" : "moon";
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
  toast(`Theme: ${document.documentElement.dataset.theme}`);
}

function computeTargets({ goal, level }) {
  // Simple heuristics (not medical advice).
  const baseCalories = goal === "weight_loss" ? 1800 : goal === "muscle_gain" ? 2400 : 2100;
  const levelAdj = level === "intermediate" ? 150 : 0;
  const calories = baseCalories + levelAdj;

  const protein =
    goal === "muscle_gain" ? 140 + (level === "intermediate" ? 20 : 0) : 110 + (level === "intermediate" ? 10 : 0);
  const water = goal === "weight_loss" ? 2.7 : 3.0;
  return { calories, protein, water };
}

function warmupCoolDown(include) {
  if (!include) return null;
  return {
    warmup: ["5–8 min brisk walk / jump rope", "Dynamic mobility (hips/shoulders) 3–5 min"],
    cooldown: ["3–5 min easy pace + breathing", "Light stretching (hamstrings, chest) 4–6 min"],
  };
}

function planTemplates() {
  // Each workout day is a template; we rotate days based on selected count.
  // "Rest" entries used to fill to 7 days.
  return {
    weight_loss: {
      beginner: [
        { name: "Cardio + Core", tag: "Low impact", items: ["20–30 min brisk walk/cycle", "Plank 3×20–30s", "Dead bug 3×10/side"] },
        { name: "Full Body (Bodyweight)", tag: "Technique", items: ["Squats 3×10", "Incline push-ups 3×8", "Glute bridge 3×12", "Bird-dog 3×10/side"] },
        { name: "Intervals", tag: "Cardio", items: ["10×(1 min fast + 1 min easy)", "Side plank 2×20s/side", "Stretch 6–8 min"] },
        { name: "Full Body + Steps", tag: "Consistency", items: ["Reverse lunges 3×8/side", "Knee push-ups 3×8", "Band rows 3×12 (or towel rows)", "8k–10k steps"] },
      ],
      intermediate: [
        { name: "HIIT + Core", tag: "Fat burn", items: ["12×(40s hard + 20s easy)", "Hollow hold 3×20–30s", "Mountain climbers 3×30s"] },
        { name: "Strength Circuit", tag: "Bodyweight", items: ["Squats 4×12", "Push-ups 4×10", "Walking lunges 3×12/side", "Inverted row 4×8 (or band row)"] },
        { name: "Cardio Endurance", tag: "Zone 2", items: ["35–45 min steady cardio", "Calf raises 3×15", "Stretch 8 min"] },
        { name: "Metcon", tag: "Mixed", items: ["3 rounds: 12 burpees, 20 air squats, 30s plank", "Farmer carry 4×30s (bags)", "Mobility 8 min"] },
      ],
    },
    muscle_gain: {
      beginner: [
        { name: "Upper Body", tag: "Strength", items: ["Push-ups (incline) 4×8", "Dumbbell/Bag rows 4×10", "Overhead press 3×10", "Biceps curls 3×12"] },
        { name: "Lower Body", tag: "Strength", items: ["Goblet squat 4×10", "Romanian deadlift (DB/bag) 4×10", "Glute bridge 3×12", "Calf raises 3×15"] },
        { name: "Full Body", tag: "Hypertrophy", items: ["Split squats 3×10/side", "Chest press/push-ups 3×10", "Rows 3×12", "Plank 3×30s"] },
        { name: "Upper + Core", tag: "Volume", items: ["Incline push-ups 4×10", "One-arm rows 4×10/side", "Lateral raises 3×12", "Leg raises 3×10"] },
      ],
      intermediate: [
        { name: "Push (Chest/Shoulders/Triceps)", tag: "Strength", items: ["Bench / Push-ups weighted 5×6–10", "Overhead press 4×6–10", "Dips 3×8–12", "Triceps extensions 3×12"] },
        { name: "Pull (Back/Biceps)", tag: "Strength", items: ["Pull-ups / Lat pulldown 4×6–10", "Row variation 4×8–12", "Face pulls 3×15", "Curls 3×10–12"] },
        { name: "Legs", tag: "Strength", items: ["Squat variation 5×5–10", "RDL 4×8–12", "Lunges 3×10/side", "Calves 4×12–15"] },
        { name: "Upper (Volume)", tag: "Hypertrophy", items: ["Incline press 4×8–12", "Row 4×10–12", "Lateral raises 4×12–15", "Core circuit 10 min"] },
      ],
    },
    general_fitness: {
      beginner: [
        { name: "Full Body", tag: "Basics", items: ["Squats 3×10", "Incline push-ups 3×8", "Hip hinge (good mornings) 3×12", "Plank 3×20–30s"] },
        { name: "Cardio + Mobility", tag: "Recovery", items: ["25–35 min easy cardio", "Mobility flow 10 min"] },
        { name: "Full Body (Circuit)", tag: "Conditioning", items: ["3 rounds: 10 squats, 8 push-ups, 10 rows, 20s plank", "Stretch 6 min"] },
        { name: "Core + Steps", tag: "Consistency", items: ["Dead bug 3×10/side", "Side plank 2×20s/side", "Glute bridge 3×12", "8k–10k steps"] },
      ],
      intermediate: [
        { name: "Strength Full Body", tag: "Balanced", items: ["Squat 4×8–10", "Press 4×8–10", "Row 4×10", "Hinge 3×10"] },
        { name: "Conditioning", tag: "Engine", items: ["20 min EMOM: 8 burpees / 12 swings / 16 step-ups (rotate)", "Mobility 8 min"] },
        { name: "Cardio Endurance", tag: "Zone 2", items: ["40–55 min steady cardio", "Core 8 min"] },
        { name: "Athletic Circuit", tag: "Power", items: ["4 rounds: 10 jumps (low), 12 lunges, 10 push-ups, 250m row/jog", "Stretch 8 min"] },
      ],
    },
  };
}

function dietTemplates() {
  return {
    veg: {
      breakfast: [
        "Overnight oats + chia + berries",
        "Moong dal chilla + mint chutney",
        "Greek yogurt (or curd) + banana + nuts",
        "Paneer/tofu scramble + whole wheat toast",
      ],
      lunch: [
        "Rajma/chole + brown rice + salad",
        "Paneer/tofu bowl + quinoa + veggies",
        "Dal + roti + mixed sabzi + curd",
        "Vegetable khichdi + salad + pickle (light)",
      ],
      dinner: [
        "Veg stir-fry + tofu/paneer + roti",
        "Dal soup + salad + roasted veggies",
        "Palak paneer + roti + cucumber salad",
        "Soya chunks curry + rice + greens",
      ],
      snacks: ["Fruit + nuts", "Roasted chana", "Buttermilk", "Protein smoothie (milk/soy)"],
    },
    nonveg: {
      breakfast: [
        "Egg omelette + toast + fruit",
        "Greek yogurt + granola + berries",
        "Egg bhurji + roti",
        "Protein smoothie + peanut butter",
      ],
      lunch: [
        "Chicken/fish + rice + salad",
        "Egg curry + roti + veggies",
        "Chicken wrap + yogurt dip + salad",
        "Tuna/chicken bowl + quinoa + veggies",
      ],
      dinner: [
        "Grilled fish + veggies + sweet potato",
        "Chicken curry + roti + greens",
        "Egg fried rice (light oil) + salad",
        "Chicken soup + whole grain toast",
      ],
      snacks: ["Boiled eggs", "Fruit + nuts", "Greek yogurt", "Roasted makhana"],
    },
  };
}

function pickN(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  while (out.length < n) out.push(arr[out.length % arr.length]);
  return out;
}

function buildWeek({ goal, level, workoutDays, includeWarmup }) {
  const tpl = planTemplates()[goal][level];
  const selected = pickN(tpl, workoutDays);
  const warm = warmupCoolDown(includeWarmup);

  // Distribute workouts across week: spread-out indices
  const indices = [];
  const step = 7 / workoutDays;
  for (let i = 0; i < workoutDays; i++) indices.push(Math.round(i * step));
  const slots = new Array(7).fill(null).map(() => ({ type: "rest", name: "Rest / Recovery", tag: "Easy", items: ["Light walk 20–30 min", "Mobility 8–10 min"] }));

  let w = 0;
  for (const idx of indices) {
    const pos = clamp(idx, 0, 6);
    // Find next available slot if collision
    let p = pos;
    while (p < 7 && slots[p].type !== "rest") p++;
    if (p >= 7) {
      p = pos;
      while (p >= 0 && slots[p].type !== "rest") p--;
    }
    if (p >= 0 && p < 7) {
      const base = selected[w % selected.length];
      slots[p] = { type: "workout", ...base, warmup: warm?.warmup ?? null, cooldown: warm?.cooldown ?? null };
      w++;
    }
  }

  // If not all workouts placed due to collisions, fill first rest slots.
  while (w < workoutDays) {
    const i = slots.findIndex((s) => s.type === "rest");
    if (i === -1) break;
    const base = selected[w % selected.length];
    slots[i] = { type: "workout", ...base, warmup: warm?.warmup ?? null, cooldown: warm?.cooldown ?? null };
    w++;
  }

  return slots.map((s, i) => ({ ...s, day: DAYS[i], index: i }));
}

function buildDiet({ diet, goal }) {
  const tpl = dietTemplates()[diet];
  const breakfast = pickN(tpl.breakfast, 1)[0];
  const lunch = pickN(tpl.lunch, 1)[0];
  const dinner = pickN(tpl.dinner, 1)[0];
  const snacks = pickN(tpl.snacks, 2);

  const goalNote =
    goal === "weight_loss"
      ? "Aim for high protein + fiber, keep portions steady."
      : goal === "muscle_gain"
        ? "Prioritize protein at every meal, add carbs around workouts."
        : "Keep meals balanced; focus on consistency and hydration.";

  return { breakfast, lunch, dinner, snacks, goalNote };
}

function renderWorkoutPlan(week) {
  const root = $("#workoutPlan");
  root.classList.remove("plan--empty");
  root.innerHTML = `
    <div class="week">
      ${week
        .map((d) => {
          const items = d.items || [];
          const warmup = d.warmup ? `<li><strong>Warm-up:</strong> ${d.warmup.join(" • ")}</li>` : "";
          const cooldown = d.cooldown ? `<li><strong>Cool-down:</strong> ${d.cooldown.join(" • ")}</li>` : "";
          const badge = d.type === "workout" ? `<span class="badge">${escapeHtml(d.tag || "Workout")}</span>` : `<span class="badge">Rest</span>`;
          return `
            <div class="day">
              <div class="day__head">
                <div>
                  <div class="day__name">${escapeHtml(d.day)} — ${escapeHtml(d.name)}</div>
                  <div class="tiny muted">${d.type === "workout" ? "Focus: " + escapeHtml(d.tag || "") : "Active recovery recommended."}</div>
                </div>
                ${badge}
              </div>
              <ul class="list">
                ${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
                ${warmup}
                ${cooldown}
              </ul>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDietPlan(dietObj) {
  const root = $("#dietPlan");
  root.classList.remove("plan--empty");
  root.innerHTML = `
    <div class="diet">
      <div class="meal">
        <div class="meal__name">Breakfast</div>
        <ul class="meal__items"><li>${escapeHtml(dietObj.breakfast)}</li></ul>
      </div>
      <div class="meal">
        <div class="meal__name">Lunch</div>
        <ul class="meal__items"><li>${escapeHtml(dietObj.lunch)}</li></ul>
      </div>
      <div class="meal">
        <div class="meal__name">Dinner</div>
        <ul class="meal__items"><li>${escapeHtml(dietObj.dinner)}</li></ul>
      </div>
      <div class="meal">
        <div class="meal__name">Snack ideas</div>
        <ul class="meal__items">
          ${dietObj.snacks.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
      </div>
      <p class="tiny muted" style="margin: 0 2px;">${escapeHtml(dietObj.goalNote)}</p>
    </div>
  `;
}

function renderMacros(targets, show) {
  const el = $("#macroNote");
  if (!el) return;
  if (!show) {
    el.textContent = "";
    return;
  }
  el.textContent = `Targets: ~${targets.calories} kcal • ~${targets.protein}g protein • ~${targets.water.toFixed(1)}L water`;
}

function renderTracker({ week, completion }) {
  const root = $("#tracker");
  root.classList.remove("plan--empty");

  const completedCount = Object.values(completion).filter(Boolean).length;
  const workoutCount = week.filter((d) => d.type === "workout").length;
  const percent = workoutCount ? Math.round((completedCount / workoutCount) * 100) : 0;

  root.innerHTML = `
    <div class="tracker-grid">
      ${week
        .map((d) => {
          const key = String(d.index);
          const checked = completion[key] ? "checked" : "";
          const restClass = d.type !== "workout" ? "track--rest" : "";
          const disabled = d.type !== "workout" ? "disabled" : "";
          return `
            <div class="track ${restClass}">
              <div class="track__top">
                <div>
                  <div class="track__day">${escapeHtml(d.day)}</div>
                  <div class="track__small">${escapeHtml(d.type === "workout" ? d.name : "Rest")}</div>
                </div>
                <span class="badge">${escapeHtml(d.type === "workout" ? "Workout" : "Rest")}</span>
              </div>
              <label class="track__toggle">
                <input data-track="${escapeHtml(key)}" type="checkbox" ${checked} ${disabled} />
                <span class="track__small">${d.type === "workout" ? "Completed" : "No workout"}</span>
              </label>
            </div>
          `;
        })
        .join("")}
    </div>
    <div class="tracker-summary">
      <div>
        <div class="progressbar" aria-label="Weekly progress">
          <div style="width:${escapeHtml(String(percent))}%"></div>
        </div>
        <div class="tiny muted" style="margin-top:8px;">
          ${escapeHtml(String(completedCount))} / ${escapeHtml(String(workoutCount))} workouts completed (${escapeHtml(String(percent))}%)
        </div>
      </div>
      <button class="chip-btn" id="markAllBtn" type="button" ${workoutCount ? "" : "disabled"}>Mark all</button>
    </div>
  `;

  // Bind toggles
  $$("input[data-track]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const k = cb.dataset.track;
      completion[k] = !!cb.checked;
      syncProgressUI(week, completion);
      autoPersistCompletion(completion);
    });
  });

  const markAllBtn = $("#markAllBtn");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", () => {
      week.forEach((d) => {
        if (d.type === "workout") completion[String(d.index)] = true;
      });
      renderTracker({ week, completion });
      syncProgressUI(week, completion);
      autoPersistCompletion(completion);
      toast("All workouts marked completed.");
    });
  }

  syncProgressUI(week, completion);
}

function syncProgressUI(week, completion) {
  const completedCount = Object.values(completion).filter(Boolean).length;
  const workoutCount = week.filter((d) => d.type === "workout").length;
  const streak = computeStreak(week, completion);
  const streakText = $("#streakText");
  if (streakText) streakText.textContent = streak ? `Streak: ${streak} workout day${streak === 1 ? "" : "s"}` : "";

  // Update progressbar
  const percent = workoutCount ? Math.round((completedCount / workoutCount) * 100) : 0;
  const bar = $(".progressbar > div");
  if (bar) bar.style.width = `${percent}%`;
}

function computeStreak(week, completion) {
  // Count consecutive completed workout days from earliest scheduled workout day.
  const workoutDays = week.filter((d) => d.type === "workout");
  if (!workoutDays.length) return 0;
  let streak = 0;
  for (const d of workoutDays) {
    if (completion[String(d.index)]) streak++;
    else break;
  }
  return streak;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPlanFromForm() {
  const goal = $("#goal").value;
  const level = $("#level").value;
  const workoutDays = Number.parseInt($("#days").value, 10);
  const diet = $("#diet").value;
  const includeWarmup = !!$("#includeWarmup").checked;
  const showCalories = !!$("#showCalories").checked;

  const week = buildWeek({ goal, level, workoutDays, includeWarmup });
  const dietObj = buildDiet({ diet, goal });
  const targets = computeTargets({ goal, level });
  const completion = {};
  week.forEach((d) => {
    if (d.type === "workout") completion[String(d.index)] = false;
  });

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    inputs: { goal, level, workoutDays, diet, includeWarmup, showCalories },
    week,
    diet: dietObj,
    targets,
    completion,
  };
}

function renderAll(plan) {
  renderWorkoutPlan(plan.week);
  renderDietPlan(plan.diet);
  renderMacros(plan.targets, plan.inputs.showCalories);
  renderTracker({ week: plan.week, completion: plan.completion });
  $("#saveBtn").disabled = false;
  $("#printBtn").disabled = false;
  $("#exportBtn").disabled = false;
}

function savePlan(plan) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

function loadSavedPlan() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function autoPersistCompletion(completion) {
  const saved = loadSavedPlan();
  if (!saved || !saved.completion) return;
  saved.completion = completion;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function applyInputsToForm(inputs) {
  if (!inputs) return;
  $("#goal").value = inputs.goal;
  $("#level").value = inputs.level;
  $("#days").value = String(inputs.workoutDays);
  $("#diet").value = inputs.diet;
  $("#includeWarmup").checked = !!inputs.includeWarmup;
  $("#showCalories").checked = !!inputs.showCalories;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function scrollToPlanner() {
  const card = $("#plannerCard");
  const goal = $("#goal");
  if (!card || !goal) return;
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => goal.focus({ preventScroll: true }), 350);
}

function initRevealAnimations() {
  const items = $$(".reveal");
  if (!items.length) return;
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => obs.observe(el));
}

function bindUI() {
  applyTheme(getThemePreference());

  $("#themeToggle").addEventListener("click", toggleTheme);
  initRevealAnimations();

  const cta = $("#ctaGenerate");
  if (cta) cta.addEventListener("click", scrollToPlanner);

  let currentPlan = null;

  $("#plannerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    currentPlan = buildPlanFromForm();
    renderAll(currentPlan);
    setStatus("Plan generated. You can save it and track progress below.");
    toast("Plan generated.");
  });

  $("#saveBtn").addEventListener("click", () => {
    if (!currentPlan) {
      setStatus("Generate a plan first.");
      return;
    }
    savePlan(currentPlan);
    toast("Plan saved on this device.");
    setStatus("Saved. Use “Load saved” anytime.");
  });

  $("#loadSavedBtn").addEventListener("click", () => {
    const plan = loadSavedPlan();
    if (!plan) {
      toast("No saved plan found.");
      setStatus("No saved plan found yet.");
      return;
    }
    currentPlan = plan;
    applyInputsToForm(plan.inputs);
    renderAll(plan);
    $("#saveBtn").disabled = false;
    setStatus("Loaded your saved plan.");
    toast("Saved plan loaded.");
  });

  $("#resetBtn").addEventListener("click", () => {
    currentPlan = null;
    $("#workoutPlan").classList.add("plan--empty");
    $("#workoutPlan").innerHTML = `<p class="muted">Generate a plan to see your workouts here.</p>`;
    $("#dietPlan").classList.add("plan--empty");
    $("#dietPlan").innerHTML = `<p class="muted">Generate a plan to see diet ideas here.</p>`;
    $("#tracker").classList.add("plan--empty");
    $("#tracker").innerHTML = `<p class="muted">Your tracker will appear after generating a plan.</p>`;
    $("#saveBtn").disabled = true;
    $("#printBtn").disabled = true;
    $("#exportBtn").disabled = true;
    $("#macroNote").textContent = "";
    $("#streakText").textContent = "";
    setStatus("");
    toast("Reset done.");
  });

  $("#exportBtn").addEventListener("click", () => {
    if (!currentPlan) return;
    downloadJson(`fitplanner-plan-${currentPlan.id}.json`, currentPlan);
    toast("Exported plan JSON.");
  });

  $("#printBtn").addEventListener("click", () => window.print());

  // Auto-load saved plan on first visit
  const saved = loadSavedPlan();
  if (saved) {
    currentPlan = saved;
    applyInputsToForm(saved.inputs);
    renderAll(saved);
    $("#saveBtn").disabled = false;
    setStatus("Loaded your saved plan. Adjust options and regenerate anytime.");
  } else {
    setStatus("Select your preferences and generate your plan.");
  }
}

document.addEventListener("DOMContentLoaded", bindUI);

