const startDate = new Date("2026-03-16T00:00:00");
const totalWeeks = 12;
const people = ["Laura", "Dino"];
const storageKey = "putzplan-all-tasks";
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

const defaultTasks = [
  { seedKey: "seed-1", name: "aufräumen", startDate: "2026-03-16", unit: "days", interval: 1, firstPerson: "Laura", builtIn: true },
  { seedKey: "seed-2", name: "staubsaugen", startDate: "2026-03-16", unit: "weeks", interval: 1, firstPerson: "Laura", builtIn: true },
  { seedKey: "seed-3", name: "Küche putzen", startDate: "2026-03-17", unit: "weeks", interval: 1, firstPerson: "Dino", builtIn: true },
  { seedKey: "seed-4", name: "WC putzen", startDate: "2026-03-18", unit: "weeks", interval: 1, firstPerson: "Laura", builtIn: true },
  { seedKey: "seed-5", name: "Bad putzen", startDate: "2026-03-20", unit: "weeks", interval: 1, firstPerson: "Dino", builtIn: true },
  { seedKey: "seed-6", name: "Bettzeug wechseln", startDate: "2026-03-16", unit: "weeks", interval: 2, firstPerson: "Laura", builtIn: true },
  { seedKey: "seed-7", name: "staubsaugen + Boden nass", startDate: "2026-03-21", unit: "weeks", interval: 4, firstPerson: "Dino", builtIn: true },
  { seedKey: "seed-8", name: "Müll rausbringen", startDate: "2026-03-16", unit: "weeks", interval: 1, firstPerson: "Dino", builtIn: true },
  { seedKey: "seed-9", name: "Müll rausbringen", startDate: "2026-03-18", unit: "weeks", interval: 1, firstPerson: "Dino", builtIn: true },
  { seedKey: "seed-10", name: "Müll rausbringen", startDate: "2026-03-20", unit: "weeks", interval: 1, firstPerson: "Laura", builtIn: true },
];

let activeFilter = "all";
let tasks = [];
let syncTimer = null;
let editingTaskId = null;

function loadLocalTasks() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : defaultTasks.map(cloneTask);
  } catch {
    return defaultTasks.map(cloneTask);
  }
}

function saveLocalTasks() {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

function cloneTask(task) {
  return {
    id: task.id || task.seedKey || `${Date.now()}-${Math.random()}`,
    seedKey: task.seedKey || null,
    name: task.name,
    startDate: task.startDate,
    unit: task.unit,
    interval: task.interval,
    firstPerson: task.firstPerson || "Laura",
    builtIn: Boolean(task.builtIn),
  };
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

function oppositePerson(person) {
  return person === "Laura" ? "Dino" : "Laura";
}

async function loadTasks() {
  if (!supabaseClient) {
    tasks = loadLocalTasks();
    return;
  }

  const { data, error } = await supabaseClient
    .from("household_tasks")
    .select("*")
    .eq("household_id", supabaseConfig.householdId)
    .order("created_at", { ascending: true });

  if (error) {
    tasks = loadLocalTasks();
    return;
  }

  if (!data.length) {
    await seedDefaultTasks();
    return;
  }

  tasks = data.map((item) => ({
    id: item.id,
    seedKey: item.seed_key || null,
    name: item.name,
    startDate: item.start_date,
    unit: item.unit,
    interval: item.interval,
    firstPerson: item.first_person || "Laura",
    builtIn: Boolean(item.built_in),
  }));
  saveLocalTasks();
}

async function seedDefaultTasks() {
  if (!supabaseClient) {
    tasks = defaultTasks.map(cloneTask);
    saveLocalTasks();
    return;
  }

  const payload = defaultTasks.map((task) => ({
    household_id: supabaseConfig.householdId,
    seed_key: task.seedKey,
    name: task.name,
    start_date: task.startDate,
    unit: task.unit,
    interval: task.interval,
    first_person: task.firstPerson,
    built_in: true,
  }));

  const { error } = await supabaseClient.from("household_tasks").insert(payload);
  if (error) {
    tasks = defaultTasks.map(cloneTask);
    saveLocalTasks();
    return;
  }

  await loadTasks();
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

function buildSchedule() {
  const days = [];

  for (let offset = 0; offset < totalWeeks * 7; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);

    days.push({
      iso: toIsoDate(date),
      title: titleCase(monthFormatter.format(date)),
      Laura: [],
      Dino: [],
    });
  }

  const counts = {};
  tasks.forEach((task) => {
    counts[task.id] = 0;
  });

  tasks
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "de"))
    .forEach((task) => {
      days.forEach((day) => {
        if (!matchesRecurrence(task, day)) {
          return;
        }

        const occurrence = counts[task.id] || 0;
        const person = occurrence % 2 === 0 ? task.firstPerson : oppositePerson(task.firstPerson);
        day[person].push(task.name);
        counts[task.id] = occurrence + 1;
      });
    });

  return days;
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

function describeRecurrence(task) {
  const units = {
    days: task.interval === 1 ? "jeden Tag" : `alle ${task.interval} Tage`,
    weeks: task.interval === 1 ? "jede Woche" : `alle ${task.interval} Wochen`,
    months: task.interval === 1 ? "jeden Monat" : `alle ${task.interval} Monate`,
  };

  return `Ab ${task.startDate} | ${units[task.unit]} | Start: ${task.firstPerson}`;
}

function renderTaskList() {
  const list = document.getElementById("custom-task-items");
  const visibleTasks =
    activeFilter === "all"
      ? tasks
      : tasks.filter((task) => task.firstPerson === activeFilter || task.firstPerson === oppositePerson(activeFilter));

  if (!visibleTasks.length) {
    list.innerHTML = '<p class="empty">Noch keine Aufgaben vorhanden.</p>';
    return;
  }

  list.innerHTML = visibleTasks
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "de"))
    .map(
      (task) => `
        <article class="custom-task-item">
          <div>
            <strong>${task.name}${task.builtIn ? " (Grundaufgabe)" : ""}</strong>
            <p>${describeRecurrence(task)}</p>
          </div>
          <div class="task-actions">
            <button class="edit-task" type="button" data-task-id="${task.id}">Bearbeiten</button>
            <button class="delete-task" type="button" data-task-id="${task.id}">Löschen</button>
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".edit-task").forEach((button) => {
    button.addEventListener("click", () => startEditingTask(button.dataset.taskId));
  });

  document.querySelectorAll(".delete-task").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteTask(button.dataset.taskId);
      if (editingTaskId === button.dataset.taskId) {
        resetTaskForm();
      }
      await renderApp();
    });
  });
}

function renderList(schedule) {
  const list = document.getElementById("day-list");
  const stats = document.getElementById("stats");
  const today = getFallbackToday(schedule);
  const visibleDays = getVisibleDays(schedule);

  stats.innerHTML = buildStats(visibleDays);
  renderTaskList();

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

function getTotalsFromDate(startIso) {
  const schedule = buildSchedule();
  const startIndex = schedule.findIndex((day) => day.iso >= startIso);
  const totals = { Laura: 0, Dino: 0 };

  for (let index = Math.max(0, startIndex); index < schedule.length; index += 1) {
    totals.Laura += schedule[index].Laura.length;
    totals.Dino += schedule[index].Dino.length;
  }

  return totals;
}

function computeFirstPerson(startIso) {
  const totals = getTotalsFromDate(startIso);
  return totals.Laura <= totals.Dino ? "Laura" : "Dino";
}

async function createTask(task) {
  const newTask = {
    ...task,
    id: task.id || `${Date.now()}-${Math.random()}`,
    firstPerson: task.firstPerson || computeFirstPerson(task.startDate),
    builtIn: Boolean(task.builtIn),
  };

  if (!supabaseClient) {
    tasks.push(newTask);
    saveLocalTasks();
    return;
  }

  const { error } = await supabaseClient.from("household_tasks").insert({
    household_id: supabaseConfig.householdId,
    seed_key: newTask.seedKey || null,
    name: newTask.name,
    start_date: newTask.startDate,
    unit: newTask.unit,
    interval: newTask.interval,
    first_person: newTask.firstPerson,
    built_in: newTask.builtIn,
  });

  if (error) {
    tasks.push(newTask);
    saveLocalTasks();
    return;
  }

  await loadTasks();
}

async function updateTask(task) {
  const updatedTask = {
    ...task,
    builtIn: Boolean(task.builtIn),
    firstPerson: task.firstPerson || computeFirstPerson(task.startDate),
  };

  if (!supabaseClient) {
    tasks = tasks.map((item) => (item.id === updatedTask.id ? updatedTask : item));
    saveLocalTasks();
    return;
  }

  const { error } = await supabaseClient
    .from("household_tasks")
    .update({
      name: updatedTask.name,
      start_date: updatedTask.startDate,
      unit: updatedTask.unit,
      interval: updatedTask.interval,
      first_person: updatedTask.firstPerson,
      built_in: updatedTask.builtIn,
    })
    .eq("id", updatedTask.id)
    .eq("household_id", supabaseConfig.householdId);

  if (error) {
    tasks = tasks.map((item) => (item.id === updatedTask.id ? updatedTask : item));
    saveLocalTasks();
    return;
  }

  await loadTasks();
}

async function deleteTask(taskId) {
  if (!supabaseClient) {
    tasks = tasks.filter((task) => task.id !== taskId);
    saveLocalTasks();
    return;
  }

  const { error } = await supabaseClient
    .from("household_tasks")
    .delete()
    .eq("id", taskId)
    .eq("household_id", supabaseConfig.householdId);

  if (error) {
    tasks = tasks.filter((task) => task.id !== taskId);
    saveLocalTasks();
    return;
  }

  await loadTasks();
}

function startEditingTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  editingTaskId = task.id;
  document.getElementById("task-id").value = task.id;
  document.getElementById("task-name").value = task.name;
  document.getElementById("task-start-date").value = task.startDate;
  document.querySelector('#task-form select[name="unit"]').value = task.unit;
  document.querySelector('#task-form input[name="interval"]').value = task.interval;
  document.getElementById("task-submit-button").textContent = "Task aktualisieren";
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
  const taskSection = document.getElementById("custom-task-list");
  const taskToggle = document.querySelector('[data-accordion="custom-task-list"]');
  const form = document.getElementById("task-form");
  const dateInput = document.getElementById("task-start-date");
  const cancelButton = document.getElementById("task-cancel-edit");

  dateInput.value = startDate.toISOString().slice(0, 10);

  openButton.addEventListener("click", () => {
    taskSection.classList.remove("hidden");
    taskToggle.setAttribute("aria-expanded", "true");
    document.getElementById("task-name").focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const rawId = String(formData.get("id") || "");
    const existingTask = tasks.find((task) => task.id === rawId);
    const task = {
      id: rawId || undefined,
      seedKey: existingTask?.seedKey || null,
      name: String(formData.get("name")).trim(),
      startDate: String(formData.get("startDate")),
      unit: String(formData.get("unit")),
      interval: Math.max(1, Number(formData.get("interval")) || 1),
      firstPerson: existingTask?.firstPerson || undefined,
      builtIn: existingTask?.builtIn || false,
    };

    if (!task.name || !task.startDate) {
      return;
    }

    if (existingTask) {
      await updateTask(task);
    } else {
      await createTask(task);
    }

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
    await loadTasks();
    await renderApp();
  }, syncIntervalMs);
}

async function initApp() {
  await loadTasks();
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
