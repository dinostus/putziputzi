const startDate = new Date("2026-03-16T00:00:00");
const totalWeeks = 12;
const people = ["Laura", "Dino"];
const storageKey = "putzplan-custom-tasks";
const baseStorageKey = "putzplan-base-tasks";
const syncIntervalMs = 15000;
const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const supabaseConfig = window.SUPABASE_CONFIG || {};
const hasSupabaseConfig =
  Boolean(supabaseConfig.url) &&
  Boolean(supabaseConfig.anonKey) &&
  Boolean(supabaseConfig.householdId) &&
  Boolean(window.supabase);
const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
const defaultBaseTasks = [
  { id: "base-1", name: "aufräumen", startDate: "2026-03-16", unit: "days", interval: 1, weekday: null, firstPerson: "Laura" },
  { id: "base-2", name: "staubsaugen", startDate: "2026-03-16", unit: "weeks", interval: 1, weekday: 1, firstPerson: "Laura" },
  { id: "base-3", name: "Küche putzen", startDate: "2026-03-17", unit: "weeks", interval: 1, weekday: 2, firstPerson: "Dino" },
  { id: "base-4", name: "WC putzen", startDate: "2026-03-18", unit: "weeks", interval: 1, weekday: 3, firstPerson: "Laura" },
  { id: "base-5", name: "Bad putzen", startDate: "2026-03-20", unit: "weeks", interval: 1, weekday: 5, firstPerson: "Dino" },
  { id: "base-6", name: "Bettzeug wechseln", startDate: "2026-03-16", unit: "weeks", interval: 2, weekday: 1, firstPerson: "Laura" },
  { id: "base-7", name: "staubsaugen + Boden nass", startDate: "2026-03-21", unit: "weeks", interval: 4, weekday: 6, firstPerson: "Dino" },
  { id: "base-8", name: "Müll rausbringen", startDate: "2026-03-16", unit: "weeks", interval: 1, weekday: 1, firstPerson: "Dino" },
  { id: "base-9", name: "Müll rausbringen", startDate: "2026-03-18", unit: "weeks", interval: 1, weekday: 3, firstPerson: "Dino" },
  { id: "base-10", name: "Müll rausbringen", startDate: "2026-03-20", unit: "weeks", interval: 1, weekday: 5, firstPerson: "Laura" },
];

let activeFilter = "all";
let customTasks = [];
let baseTasks = loadBaseTasks();
let syncTimer = null;
let editingTaskId = null;

function loadLocalCustomTasks() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTasks() {
  localStorage.setItem(storageKey, JSON.stringify(customTasks));
}

function loadBaseTasks() {
  try {
    const raw = localStorage.getItem(baseStorageKey);
    return raw ? JSON.parse(raw) : [...defaultBaseTasks];
  } catch {
    return [...defaultBaseTasks];
  }
}

function saveBaseTasks() {
  localStorage.setItem(baseStorageKey, JSON.stringify(baseTasks));
}

async function loadCustomTasks() {
  if (!supabaseClient) {
    customTasks = loadLocalCustomTasks();
    return;
  }

  const { data, error } = await supabaseClient
    .from("household_tasks")
    .select("id, household_id, name, start_date, unit, interval, created_at")
    .eq("household_id", supabaseConfig.householdId)
    .order("created_at", { ascending: true });

  if (error) {
    customTasks = loadLocalCustomTasks();
    return;
  }

  customTasks = data.map((item) => ({
    id: item.id,
    name: item.name,
    startDate: item.start_date,
    unit: item.unit,
    interval: item.interval,
  }));
  saveCustomTasks();
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function fromIsoDate(value) {
  return new Date(`${value}T00:00:00`);
}

function titleCase(input) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function buildBaseSchedule() {
  const days = [];

  for (let offset = 0; offset < totalWeeks * 7; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    const weekIndex = Math.floor(offset / 7);
    const dayOfWeek = date.getDay();

    const entry = {
      iso: toIsoDate(date),
      title: titleCase(monthFormatter.format(date)),
      Laura: [],
      Dino: [],
      note: "",
    };

    days.push(entry);
  }

  const occurrences = {};
  baseTasks.forEach((task) => {
    occurrences[task.id] = 0;
  });

  days.forEach((day) => {
    baseTasks.forEach((task) => {
      if (!matchesRecurrence(task, day)) {
        return;
      }

      const occurrence = occurrences[task.id] || 0;
      const assignedPerson = occurrence % 2 === 0 ? task.firstPerson : oppositePerson(task.firstPerson);
      day[assignedPerson].push(task.name);
      occurrences[task.id] = occurrence + 1;
    });
  });

  return days;
}

function oppositePerson(person) {
  return person === "Laura" ? "Dino" : "Laura";
}

function matchesRecurrence(task, day) {
  const currentDate = fromIsoDate(day.iso);
  const start = fromIsoDate(task.startDate);

  if (currentDate < start) {
    return false;
  }

  const diffDays = Math.floor((currentDate - start) / 86400000);

  if (task.unit === "days") {
    return diffDays % task.interval === 0;
  }

  if (task.unit === "weeks") {
    return currentDate.getDay() === start.getDay() && diffDays % (task.interval * 7) === 0;
  }

  if (task.unit === "months") {
    if (currentDate.getDate() !== start.getDate()) {
      return false;
    }

    const monthDiff =
      (currentDate.getFullYear() - start.getFullYear()) * 12 +
      (currentDate.getMonth() - start.getMonth());

    return monthDiff >= 0 && monthDiff % task.interval === 0;
  }

  return false;
}

function getTotalsFromIndex(schedule, startIndex) {
  const totals = { Laura: 0, Dino: 0 };

  for (let index = startIndex; index < schedule.length; index += 1) {
    totals.Laura += schedule[index].Laura.length;
    totals.Dino += schedule[index].Dino.length;
  }

  return totals;
}

function applyCustomTasks(schedule) {
  const sortedTasks = [...customTasks].sort((a, b) => a.startDate.localeCompare(b.startDate));

  sortedTasks.forEach((task) => {
    const matchingIndexes = [];

    schedule.forEach((day, index) => {
      if (matchesRecurrence(task, day)) {
        matchingIndexes.push(index);
      }
    });

    if (!matchingIndexes.length) {
      return;
    }

    const totals = getTotalsFromIndex(schedule, matchingIndexes[0]);
    let nextPerson = totals.Laura <= totals.Dino ? "Laura" : "Dino";

    matchingIndexes.forEach((index) => {
      schedule[index][nextPerson].push(task.name);
      nextPerson = nextPerson === "Laura" ? "Dino" : "Laura";
    });
  });

  return schedule;
}

function buildSchedule() {
  return applyCustomTasks(buildBaseSchedule());
}

function buildTaskSummary(schedule) {
  const map = new Map();

  schedule.forEach((day) => {
    people.forEach((person) => {
      day[person].forEach((task) => {
        if (!map.has(task)) {
          map.set(task, { task, Laura: 0, Dino: 0, total: 0 });
        }

        const entry = map.get(task);
        entry[person] += 1;
        entry.total += 1;
      });
    });
  });

  return Array.from(map.values()).sort((a, b) => a.task.localeCompare(b.task, "de"));
}

function getVisibleDays(schedule) {
  if (activeFilter === "all") {
    return schedule;
  }

  return schedule.filter((day) => day[activeFilter].length > 0);
}

function buildStats(visibleDays) {
  const counts = { Laura: 0, Dino: 0 };

  visibleDays.forEach((day) => {
    counts.Laura += day.Laura.length;
    counts.Dino += day.Dino.length;
  });

  return [
    { label: "Sync", value: supabaseClient ? "Supabase" : "Nur dieses Gerät" },
    { label: "Tage sichtbar", value: visibleDays.length },
    { label: "Laura Aufgaben", value: counts.Laura },
    { label: "Dino Aufgaben", value: counts.Dino },
  ]
    .map(
      (stat) => `
        <article class="stat-box">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderTaskOverview(taskSummary) {
  const container = document.getElementById("task-overview");
  const visibleTasks =
    activeFilter === "all"
      ? taskSummary
      : taskSummary.filter((item) => item[activeFilter] > 0);

  container.innerHTML = visibleTasks
    .map((item) => {
      const meta =
        activeFilter === "all"
          ? `Laura: ${item.Laura} | Dino: ${item.Dino} | Gesamt: ${item.total}`
          : `${activeFilter}: ${item[activeFilter]} mal`;

      return `
        <article class="task-box">
          <h4>${item.task}</h4>
          <p class="task-meta">${meta}</p>
        </article>
      `;
    })
    .join("");
}

function renderCustomTaskList() {
  const list = document.getElementById("custom-task-items");

  if (!customTasks.length) {
    list.innerHTML = '<p class="empty">Noch keine eigenen Aufgaben hinzugefügt.</p>';
    return;
  }

  list.innerHTML = customTasks
    .map(
      (task) => `
        <article class="custom-task-item">
          <div>
            <strong>${task.name}</strong>
            <p>${describeRecurrence(task)}</p>
          </div>
          <div class="task-actions">
            <button class="edit-task" type="button" data-task-id="${task.id}">Bearbeiten</button>
            <button class="delete-task" type="button" data-task-id="${task.id}">Entfernen</button>
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".edit-task").forEach((button) => {
    button.addEventListener("click", () => {
      startEditingTask(button.dataset.taskId);
    });
  });

  document.querySelectorAll(".delete-task").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteCustomTask(button.dataset.taskId);
      if (editingTaskId === button.dataset.taskId) {
        resetTaskForm();
      }
      await renderApp();
    });
  });
}

function renderBaseTaskList() {
  const list = document.getElementById("base-task-items");

  list.innerHTML = baseTasks
    .map(
      (task) => `
        <article class="custom-task-item">
          <div>
            <strong>${task.name}</strong>
            <p>${describeRecurrence(task)} | Start: ${task.firstPerson}</p>
          </div>
          <div class="task-actions">
            <button class="edit-base-task" type="button" data-task-id="${task.id}">Umbenennen</button>
            <button class="delete-base-task" type="button" data-task-id="${task.id}">Löschen</button>
            <button class="reset-task" type="button" data-task-id="${task.id}">Standardname</button>
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".edit-base-task").forEach((button) => {
    button.addEventListener("click", () => {
      const task = baseTasks.find((item) => item.id === button.dataset.taskId);
      if (!task) return;
      const newName = window.prompt("Neuer Name für diese Grundplan-Aufgabe:", task.name);
      if (!newName || !newName.trim()) return;
      baseTasks = baseTasks.map((item) =>
        item.id === task.id ? { ...item, name: newName.trim() } : item
      );
      saveBaseTasks();
      renderApp();
    });
  });

  document.querySelectorAll(".delete-base-task").forEach((button) => {
    button.addEventListener("click", () => {
      baseTasks = baseTasks.filter((item) => item.id !== button.dataset.taskId);
      saveBaseTasks();
      renderApp();
    });
  });

  document.querySelectorAll(".reset-task").forEach((button) => {
    button.addEventListener("click", () => {
      const original = defaultBaseTasks.find((item) => item.id === button.dataset.taskId);
      if (!original) return;
      baseTasks = baseTasks.map((item) =>
        item.id === original.id ? { ...item, name: original.name } : item
      );
      saveBaseTasks();
      renderApp();
    });
  });
}

function describeRecurrence(task) {
  const units = {
    days: task.interval === 1 ? "jeden Tag" : `alle ${task.interval} Tage`,
    weeks: task.interval === 1 ? "jede Woche" : `alle ${task.interval} Wochen`,
    months: task.interval === 1 ? "jeden Monat" : `alle ${task.interval} Monate`,
  };

  return `Ab ${task.startDate} | ${units[task.unit]}`;
}

function renderList(schedule) {
  const list = document.getElementById("day-list");
  const stats = document.getElementById("stats");
  const today = getFallbackToday(schedule);
  const visibleDays = getVisibleDays(schedule);
  const taskSummary = buildTaskSummary(schedule);

  stats.innerHTML = buildStats(visibleDays);
  renderTaskOverview(taskSummary);
  renderBaseTaskList();
  renderCustomTaskList();

  list.innerHTML = visibleDays
    .map((day) => {
      const lauraTasks = day.Laura.length
        ? `<ul class="task-list">${day.Laura.map((task) => `<li>${task}</li>`).join("")}</ul>`
        : '<p class="empty">Heute nichts extra.</p>';

      const dinoTasks = day.Dino.length
        ? `<ul class="task-list">${day.Dino.map((task) => `<li>${task}</li>`).join("")}</ul>`
        : '<p class="empty">Heute nichts extra.</p>';

      return `
        <article class="day-card ${day.iso === today.iso ? "today" : ""}">
          <div class="day-top">
            <div>
              <p class="date-title">${day.title}</p>
            </div>
            ${day.iso === today.iso ? '<span class="date-badge">Heute</span>' : ""}
          </div>
          <div class="columns">
            ${
              activeFilter !== "Dino"
                ? `<section class="person-box laura"><h4>Laura</h4>${lauraTasks}</section>`
                : ""
            }
            ${
              activeFilter !== "Laura"
                ? `<section class="person-box dino"><h4>Dino</h4>${dinoTasks}</section>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function getFallbackToday(schedule) {
  const todayIso = toIsoDate(new Date());
  return schedule.find((day) => day.iso === todayIso) || schedule[0];
}

function renderToday(schedule) {
  const today = getFallbackToday(schedule);
  document.getElementById("today-date").textContent = today.title;

  const summaries = [];
  if (today.Laura.length) {
    summaries.push(`Laura: ${today.Laura.join(", ")}`);
  }
  if (today.Dino.length) {
    summaries.push(`Dino: ${today.Dino.join(", ")}`);
  }

  document.getElementById("today-summary").textContent =
    summaries.join(" | ") || "Heute sind keine Extra-Aufgaben eingeplant.";
}

async function renderApp() {
  const schedule = buildSchedule();
  renderToday(schedule);
  renderList(schedule);
}

function bindFilters() {
  document.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".chip").forEach((chip) => {
        chip.classList.toggle("active", chip === button);
      });
      renderApp();
    });
  });
}

function bindAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.accordion);
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", isExpanded ? "false" : "true");
      target.classList.toggle("hidden", isExpanded);
    });
  });
}

async function upsertCustomTask(task) {
  if (task.id && customTasks.some((item) => item.id === task.id)) {
    return updateCustomTask(task);
  }

  if (!supabaseClient) {
    customTasks.push(task);
    saveCustomTasks();
    return;
  }

  const { error } = await supabaseClient.from("household_tasks").insert({
    household_id: supabaseConfig.householdId,
    name: task.name,
    start_date: task.startDate,
    unit: task.unit,
    interval: task.interval,
  });

  if (error) {
    customTasks.push(task);
    saveCustomTasks();
    return;
  }

  await loadCustomTasks();
}

async function updateCustomTask(task) {
  if (!supabaseClient) {
    customTasks = customTasks.map((item) => (item.id === task.id ? task : item));
    saveCustomTasks();
    return;
  }

  const { error } = await supabaseClient
    .from("household_tasks")
    .update({
      name: task.name,
      start_date: task.startDate,
      unit: task.unit,
      interval: task.interval,
    })
    .eq("id", task.id)
    .eq("household_id", supabaseConfig.householdId);

  if (error) {
    customTasks = customTasks.map((item) => (item.id === task.id ? task : item));
    saveCustomTasks();
    return;
  }

  await loadCustomTasks();
}

async function deleteCustomTask(taskId) {
  if (!supabaseClient) {
    customTasks = customTasks.filter((task) => task.id !== taskId);
    saveCustomTasks();
    return;
  }

  const { error } = await supabaseClient
    .from("household_tasks")
    .delete()
    .eq("id", taskId)
    .eq("household_id", supabaseConfig.householdId);

  if (error) {
    customTasks = customTasks.filter((task) => task.id !== taskId);
    saveCustomTasks();
    return;
  }

  await loadCustomTasks();
}

function startEditingTask(taskId) {
  const task = customTasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  editingTaskId = task.id;
  document.getElementById("task-id").value = task.id;
  document.getElementById("task-name").value = task.name;
  document.getElementById("task-start-date").value = task.startDate;
  document.querySelector('#task-form select[name="unit"]').value = task.unit;
  document.querySelector('#task-form input[name="interval"]').value = task.interval;
  document.getElementById("task-submit-button").textContent = "Aufgabe aktualisieren";
  document.getElementById("task-cancel-edit").classList.remove("hidden");
  document.getElementById("custom-task-list").classList.remove("hidden");
  document.querySelector('[data-accordion="custom-task-list"]').setAttribute("aria-expanded", "true");
  document.getElementById("task-name").focus();
}

function resetTaskForm() {
  editingTaskId = null;
  document.getElementById("task-form").reset();
  document.getElementById("task-id").value = "";
  document.getElementById("task-start-date").value = startDate.toISOString().slice(0, 10);
  document.querySelector('#task-form select[name="unit"]').value = "weeks";
  document.querySelector('#task-form input[name="interval"]').value = 1;
  document.getElementById("task-submit-button").textContent = "Aufgabe speichern";
  document.getElementById("task-cancel-edit").classList.add("hidden");
}

function bindTaskForm() {
  const openButton = document.getElementById("open-task-form");
  const customTaskSection = document.getElementById("custom-task-list");
  const customTaskToggle = document.querySelector('[data-accordion="custom-task-list"]');
  const form = document.getElementById("task-form");
  const dateInput = document.getElementById("task-start-date");
  const cancelButton = document.getElementById("task-cancel-edit");

  dateInput.value = startDate.toISOString().slice(0, 10);

  openButton.addEventListener("click", () => {
    customTaskSection.classList.remove("hidden");
    customTaskToggle.setAttribute("aria-expanded", "true");
    document.getElementById("task-name").focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const task = {
      id: String(formData.get("id") || `${Date.now()}`),
      name: String(formData.get("name")).trim(),
      startDate: String(formData.get("startDate")),
      unit: String(formData.get("unit")),
      interval: Math.max(1, Number(formData.get("interval")) || 1),
    };

    if (!task.name || !task.startDate) {
      return;
    }

    await upsertCustomTask(task);
    resetTaskForm();
    await renderApp();
  });

  cancelButton.addEventListener("click", () => {
    resetTaskForm();
  });
}

async function startPolling() {
  if (!supabaseClient) {
    return;
  }

  if (syncTimer) {
    clearInterval(syncTimer);
  }

  syncTimer = setInterval(async () => {
    await loadCustomTasks();
    await renderApp();
  }, syncIntervalMs);
}

async function initApp() {
  await loadCustomTasks();
  bindFilters();
  bindAccordions();
  bindTaskForm();
  await renderApp();
  await startPolling();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }
}

window.addEventListener("DOMContentLoaded", initApp);
