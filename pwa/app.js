const initialStartDate = new Date("2026-03-16T00:00:00");
const scheduleDays = 365;
const people = ["Laura", "Dino"];
const storageKey = "putzplan-all-tasks";
const completionStorageKey = "putzplan-completions";
const completionDetailsStorageKey = "putzplan-completion-details";
const postponementStorageKey = "putzplan-postponements";
const themeStorageKey = "putzplan-theme";
const personStorageKey = "putzplan-person";
const chatStorageKey = "putzplan-chat-messages";
const chatReadStorageKey = "putzplan-chat-read";
const musicEnabledStorageKey = "putzplan-music-enabled";
const stickerSeenStorageKey = "putzplan-sticker-seen";
const backgroundMusicSrc = "./time.mp3";
const syncIntervalMs = 15000;
const weatherRefreshMs = 15 * 60 * 1000;
const defaultWeatherCoords = { latitude: 48.3069, longitude: 14.2858 };
const cleanupAnchorIso = "2026-03-27";
const cleanupAnchorPerson = "Dino";
const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const calendarMonthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});
const chatTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
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

const starterTasks = [
  { seedKey: "seed-1", name: "aufräumen", startDate: "2026-03-16", unit: "days", interval: 1, firstPerson: "Laura" },
  { seedKey: "seed-2", name: "staubsaugen", startDate: "2026-03-16", unit: "weeks", interval: 1, firstPerson: "Laura" },
  { seedKey: "seed-3", name: "Küche putzen", startDate: "2026-03-17", unit: "weeks", interval: 1, firstPerson: "Dino" },
  { seedKey: "seed-4", name: "WC putzen", startDate: "2026-03-18", unit: "weeks", interval: 1, firstPerson: "Laura" },
  { seedKey: "seed-5", name: "Bad putzen", startDate: "2026-03-20", unit: "weeks", interval: 1, firstPerson: "Dino" },
  { seedKey: "seed-6", name: "Bettzeug wechseln", startDate: "2026-03-16", unit: "weeks", interval: 2, firstPerson: "Laura" },
  { seedKey: "seed-7", name: "staubsaugen + Boden nass", startDate: "2026-03-21", unit: "weeks", interval: 4, firstPerson: "Dino" },
  { seedKey: "seed-8", name: "Müll rausbringen", startDate: "2026-03-16", unit: "weeks", interval: 1, firstPerson: "Dino" },
  { seedKey: "seed-9", name: "Müll rausbringen", startDate: "2026-03-18", unit: "weeks", interval: 1, firstPerson: "Dino" },
  { seedKey: "seed-10", name: "Müll rausbringen", startDate: "2026-03-20", unit: "weeks", interval: 1, firstPerson: "Laura" },
];

let activeFilter = "all";
let tasks = [];
let completions = {};
let completionDetails = {};
let postponements = {};
let syncTimer = null;
let weatherTimer = null;
let editingTaskId = null;
let selectedDayIso = null;
let expandedTaskStat = null;
let expandedTaskId = null;
let dayListMode = "upcoming";
let activeTheme = "light";
let currentTodayIso = null;
let currentPerson = "Laura";
let chatMessages = [];
let chatReadState = {};
let stickerSeenState = {};
let currentWeather = { temperature: null, variant: "clear", isDay: true };
let musicEnabled = false;
let backgroundMusic = null;
let pendingKassaAnimation = null;
const stickers = [
  { id: "fruehstarter", title: "Frühstarter", src: "./stickers/NEW_STICKERS_CUTOUTS/Frühstarter.png" },
  { id: "abendfleiss", title: "Abendfleiß", src: "./stickers/NEW_STICKERS_CUTOUTS/abendfleiß.png" },
  { id: "alles-geschafft", title: "Alles geschafft", src: "./stickers/NEW_STICKERS_CUTOUTS/alles geschafft.png" },
  { id: "wochenwunder", title: "Wochenwunder", src: "./stickers/NEW_STICKERS_CUTOUTS/Wochenwunder.png" },
  { id: "staubjaeger", title: "Staubjäger", src: "./stickers/NEW_STICKERS_CUTOUTS/staubjäger.png" },
  { id: "glanzkueche", title: "Glanzküche", src: "./stickers/NEW_STICKERS_CUTOUTS/glanzküche.png" },
  { id: "badzauber", title: "Badzauber", src: "./stickers/NEW_STICKERS_CUTOUTS/badzauber.png" },
  { id: "wischprofi", title: "Wischprofi", src: "./stickers/NEW_STICKERS_CUTOUTS/wischprofi.png" },
  { id: "teamgeist", title: "Teamgeist", src: "./stickers/NEW_STICKERS_CUTOUTS/teamgeist.png" },
];

function loadLocalTasks() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : starterTasks.map(cloneTask);
  } catch {
    return starterTasks.map(cloneTask);
  }
}

function saveLocalTasks() {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

function loadLocalCompletions() {
  try {
    const raw = localStorage.getItem(completionStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadLocalCompletionDetails() {
  try {
    const raw = localStorage.getItem(completionDetailsStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadLocalPostponements() {
  try {
    const raw = localStorage.getItem(postponementStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadLocalTheme() {
  try {
    return localStorage.getItem(themeStorageKey) || "light";
  } catch {
    return "light";
  }
}

function loadLocalPerson() {
  try {
    return localStorage.getItem(personStorageKey) || "Laura";
  } catch {
    return "Laura";
  }
}

function loadLocalChatMessages() {
  try {
    const raw = localStorage.getItem(chatStorageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadLocalChatReadState() {
  try {
    const raw = localStorage.getItem(chatReadStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadLocalMusicEnabled() {
  try {
    return localStorage.getItem(musicEnabledStorageKey) === "true";
  } catch {
    return false;
  }
}

function loadLocalStickerSeenState() {
  try {
    const raw = localStorage.getItem(stickerSeenStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalTheme() {
  localStorage.setItem(themeStorageKey, activeTheme);
}

function saveLocalPerson() {
  localStorage.setItem(personStorageKey, currentPerson);
}

function saveLocalChatMessages() {
  localStorage.setItem(chatStorageKey, JSON.stringify(chatMessages));
}

function saveLocalChatReadState() {
  localStorage.setItem(chatReadStorageKey, JSON.stringify(chatReadState));
}

function saveLocalCompletions() {
  localStorage.setItem(completionStorageKey, JSON.stringify(completions));
}

function saveLocalCompletionDetails() {
  localStorage.setItem(completionDetailsStorageKey, JSON.stringify(completionDetails));
}

function saveLocalPostponements() {
  localStorage.setItem(postponementStorageKey, JSON.stringify(postponements));
}

function saveLocalMusicEnabled() {
  localStorage.setItem(musicEnabledStorageKey, musicEnabled ? "true" : "false");
}

function saveLocalStickerSeenState() {
  localStorage.setItem(stickerSeenStorageKey, JSON.stringify(stickerSeenState));
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
  };
}

function applyTheme(theme) {
  activeTheme = theme === "dark" ? "dark" : "light";
  document.body.setAttribute("data-theme", activeTheme);
  const lightButton = document.getElementById("light-theme-button");
  const darkButton = document.getElementById("dark-theme-button");

  if (lightButton && darkButton) {
    lightButton.classList.toggle("active-theme", activeTheme === "light");
    darkButton.classList.toggle("active-theme", activeTheme === "dark");
  }

  saveLocalTheme();
}

function applyPerson(person) {
  currentPerson = people.includes(person) ? person : "Laura";
  document.querySelectorAll(".identity-button").forEach((button) => {
    button.classList.toggle("active-identity", button.dataset.person === currentPerson);
  });
  saveLocalPerson();
}

function bindPress(element, handler) {
  let lastTriggerAt = 0;

  const onPress = async (event) => {
    const now = Date.now();
    if (now - lastTriggerAt < 350) {
      return;
    }

    lastTriggerAt = now;
    event.preventDefault();
    await handler();
  };

  element.addEventListener("click", onPress);
  element.addEventListener("touchend", onPress, { passive: false });
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function titleCase(input) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function classifyWeatherVariant(code) {
  if ([0, 1].includes(code)) {
    return "clear";
  }
  if ([2, 3].includes(code)) {
    return "cloudy";
  }
  if ([45, 48].includes(code)) {
    return "fog";
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "snow";
  }
  if ([95, 96, 99].includes(code)) {
    return "storm";
  }
  return "rain";
}

function getWeatherSceneKey() {
  const variant = currentWeather.variant || "clear";
  return `${variant}-${currentWeather.isDay === false ? "night" : "day"}`;
}

function renderHeroWeather() {
  const hero = document.querySelector(".hero");

  if (!hero) {
    return;
  }

  hero.dataset.weatherScene = getWeatherSceneKey();
}

function getCurrentPositionOrFallback() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(defaultWeatherCoords);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve(defaultWeatherCoords),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
    );
  });
}

async function loadWeather() {
  try {
    const coords = await getCurrentPositionOrFallback();
    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      current: "temperature_2m,weather_code,is_day",
      timezone: "auto",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!response.ok) {
      throw new Error("weather fetch failed");
    }

    const data = await response.json();
    currentWeather = {
      temperature: data?.current?.temperature_2m ?? null,
      variant: classifyWeatherVariant(data?.current?.weather_code),
      isDay: data?.current?.is_day !== 0,
    };
  } catch {
    currentWeather = { temperature: null, variant: "clear", isDay: true };
  }
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
  }));
  saveLocalTasks();
}

async function loadCompletions() {
  if (!supabaseClient) {
    completions = loadLocalCompletions();
    return;
  }

  const { data, error } = await supabaseClient
    .from("household_task_completions")
    .select("completion_key, done")
    .eq("household_id", supabaseConfig.householdId);

  if (error) {
    completions = loadLocalCompletions();
    return;
  }

  completions = {};
  data.forEach((item) => {
    completions[item.completion_key] = Boolean(item.done);
  });
  saveLocalCompletions();
}

function getCompletedEntries(schedule) {
  const entries = [];

  schedule.forEach((day) => {
    ["Laura", "Dino"].forEach((person) => {
      day[person].forEach((item) => {
        if (!completions[item.key]) {
          return;
        }

        entries.push({
          key: item.key,
          iso: day.iso,
          person,
          name: item.name,
          completedAt: completionDetails[item.key]?.completedAt || null,
        });
      });
    });
  });

  return entries;
}

async function loadChatMessages() {
  if (!supabaseClient) {
    chatMessages = loadLocalChatMessages();
    return;
  }

  const { data, error } = await supabaseClient
    .from("household_chat_messages")
    .select("*")
    .eq("household_id", supabaseConfig.householdId)
    .order("created_at", { ascending: true });

  if (error) {
    chatMessages = loadLocalChatMessages();
    return;
  }

  chatMessages = data.map((item) => ({
    id: item.id,
    person: item.person,
    message: item.message,
    createdAt: item.created_at,
  }));
  saveLocalChatMessages();
}

async function seedDefaultTasks() {
  if (!supabaseClient) {
    tasks = starterTasks.map(cloneTask);
    saveLocalTasks();
    return;
  }

  const payload = starterTasks.map((task) => ({
    household_id: supabaseConfig.householdId,
    seed_key: task.seedKey,
    name: task.name,
    start_date: task.startDate,
    unit: task.unit,
    interval: task.interval,
    first_person: task.firstPerson,
  }));

  const { error } = await supabaseClient.from("household_tasks").insert(payload);
  if (error) {
    tasks = starterTasks.map(cloneTask);
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

  const diffDays = toDayNumber(currentDate) - toDayNumber(start);

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

function getScheduleStartDate() {
  const startDates = tasks
    .map((task) => task.startDate)
    .filter(Boolean)
    .sort();

  if (!startDates.length) {
    return new Date(initialStartDate);
  }

  const earliestTaskDate = fromIsoDate(startDates[0]);
  return earliestTaskDate < initialStartDate ? earliestTaskDate : new Date(initialStartDate);
}

function isLegacyFloorMopTask(task) {
  return task.seedKey === "seed-7" || task.name === "staubsaugen + Boden nass";
}

function isEveningCleanupTask(task) {
  return (
    task.seedKey === "seed-1" ||
    task.name === "aufräumen" ||
    task.name === "aufräumen ab 18 Uhr"
  );
}

function getEveningCleanupDisplayName() {
  return "aufräumen ab 18 Uhr";
}

function getCleanupWindowPerson(task, windowStartIso) {
  const anchorDate = fromIsoDate(cleanupAnchorIso);
  const windowStart = fromIsoDate(windowStartIso);
  const diffDays = toDayNumber(windowStart) - toDayNumber(anchorDate);

  return Math.abs(diffDays) % 2 === 0
    ? cleanupAnchorPerson
    : oppositePerson(cleanupAnchorPerson);
}

function getCurrentCleanupAssignment(task, dayIso) {
  const windowStartIso = dayIso;
  const person = getCleanupWindowPerson(task, windowStartIso);
  return {
    taskId: task.id,
    name: getEveningCleanupDisplayName(),
    key: `${windowStartIso}|${person}|${task.id}|cleanup`,
    person,
    windowStartIso,
  };
}

function isPostponableItem(item) {
  if (!item) {
    return false;
  }

  if (item.name === getEveningCleanupDisplayName()) {
    return false;
  }

  if (item.name === "Müll rausbringen") {
    return false;
  }

  return true;
}

function addOneDay(iso) {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + 1);
  return toIsoDate(date);
}

function applyPostponements(days) {
  Object.entries(postponements).forEach(([itemKey, targetIso]) => {
    if (!targetIso) {
      return;
    }

    let movedItem = null;
    let sourcePerson = null;

    days.forEach((day) => {
      ["Laura", "Dino"].forEach((person) => {
        const itemIndex = day[person].findIndex((entry) => entry.key === itemKey);
        if (itemIndex >= 0) {
          movedItem = day[person][itemIndex];
          sourcePerson = person;
          day[person].splice(itemIndex, 1);
        }
      });
    });

    if (!movedItem || !sourcePerson) {
      return;
    }

    const targetDay = days.find((day) => day.iso === targetIso);
    if (!targetDay) {
      return;
    }

    targetDay[sourcePerson].push(movedItem);
  });
}

function choosePersonForTask(task, day, taskCounts, overallCounts, occurrence) {
  const perTaskCounts = taskCounts[task.id] || { Laura: 0, Dino: 0 };
  const dayCounts = {
    Laura: day.Laura.length,
    Dino: day.Dino.length,
  };

  if (task.unit === "days") {
    return occurrence % 2 === 0 ? task.firstPerson || "Laura" : oppositePerson(task.firstPerson || "Laura");
  }

  if (perTaskCounts.Laura !== perTaskCounts.Dino) {
    return perTaskCounts.Laura < perTaskCounts.Dino ? "Laura" : "Dino";
  }

  if (dayCounts.Laura !== dayCounts.Dino) {
    return dayCounts.Laura < dayCounts.Dino ? "Laura" : "Dino";
  }

  if (overallCounts.Laura !== overallCounts.Dino) {
    return overallCounts.Laura < overallCounts.Dino ? "Laura" : "Dino";
  }

  return occurrence % 2 === 0 ? task.firstPerson || "Laura" : oppositePerson(task.firstPerson || "Laura");
}

function choosePersonForDeepClean(specialOccurrence) {
  return specialOccurrence % 2 === 0 ? "Laura" : "Dino";
}

function buildSchedule() {
  const days = [];
  const scheduleStartDate = getScheduleStartDate();

  for (let offset = 0; offset < scheduleDays; offset += 1) {
    const date = new Date(scheduleStartDate);
    date.setDate(scheduleStartDate.getDate() + offset);

    days.push({
      iso: toIsoDate(date),
      title: titleCase(monthFormatter.format(date)),
      Laura: [],
      Dino: [],
    });
  }

  const counts = {};
  const overallCounts = { Laura: 0, Dino: 0 };
  tasks.forEach((task) => {
    counts[task.id] = { Laura: 0, Dino: 0 };
  });

  let cleanupOccurrence = 0;

  tasks
    .slice()
    .filter((task) => !isLegacyFloorMopTask(task))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "de"))
    .forEach((task) => {
      if (isEveningCleanupTask(task)) {
        days.forEach((day) => {
          if (!matchesRecurrence(task, day)) {
            return;
          }

          const basePerson = task.firstPerson || "Laura";
          const person = cleanupOccurrence % 2 === 0 ? basePerson : oppositePerson(basePerson);
          const item = {
            taskId: task.id,
            name: getEveningCleanupDisplayName(),
            key: `${day.iso}|${person}|${task.id}|cleanup|${cleanupOccurrence}`,
          };
          day[person].push(item);
          counts[task.id][person] += 1;
          overallCounts[person] += 1;
          cleanupOccurrence += 1;
        });
        return;
      }

      days.forEach((day) => {
        if (!matchesRecurrence(task, day)) {
          return;
        }

        const perTaskCounts = counts[task.id] || { Laura: 0, Dino: 0 };
        const occurrence = perTaskCounts.Laura + perTaskCounts.Dino;
        const isDeepClean = task.seedKey === "seed-2" && (occurrence + 1) % 4 === 0;
        const specialOccurrence = isDeepClean ? Math.floor((occurrence + 1) / 4) - 1 : null;
        const person = isDeepClean
          ? choosePersonForDeepClean(specialOccurrence)
          : choosePersonForTask(task, day, counts, overallCounts, occurrence);
        const taskName = isDeepClean ? "staubsaugen + Boden nass" : task.name;
        const item = {
          taskId: task.id,
          name: taskName,
          key: `${day.iso}|${person}|${task.id}|${occurrence}`,
        };
        day[person].push(item);
        counts[task.id][person] += 1;
        overallCounts[person] += 1;
      });
    });

  applyPostponements(days);

  return days;
}

function getVisibleDays(schedule) {
  if (activeFilter === "all") {
    return schedule;
  }

  return schedule.filter((day) => day[activeFilter].length > 0);
}

function formatSelectedDateLabel(iso) {
  return titleCase(monthFormatter.format(fromIsoDate(iso)));
}

function getDayListDays(schedule) {
  const visibleDays = getVisibleDays(schedule);
  const todayIso = toIsoDate(new Date());

  if (dayListMode === "past" && !selectedDayIso) {
    return visibleDays.filter((day) => day.iso < todayIso).reverse();
  }

  const anchorIso = selectedDayIso || toIsoDate(new Date());

  const startIndex = visibleDays.findIndex((day) => day.iso >= anchorIso);
  const normalizedStartIndex = startIndex >= 0 ? startIndex : 0;
  return visibleDays.slice(normalizedStartIndex, normalizedStartIndex + 10);
}

function getDayCompletionSummary(day) {
  const items = [...day.Laura, ...day.Dino];
  const completed = items.filter((item) => completions[item.key]).length;
  return {
    total: items.length,
    completed,
    open: items.length - completed,
  };
}

function getWeekDays(schedule, todayIso) {
  const todayDate = fromIsoDate(todayIso);
  const dayOfWeek = (todayDate.getDay() + 6) % 7;
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - dayOfWeek);
  const weekStartIso = toIsoDate(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndIso = toIsoDate(weekEnd);
  return schedule.filter((day) => day.iso >= weekStartIso && day.iso <= weekEndIso);
}

function getPersonTaskTotals(days) {
  return days.reduce(
    (counts, day) => {
      counts.Laura += day.Laura.length;
      counts.Dino += day.Dino.length;
      return counts;
    },
    { Laura: 0, Dino: 0 }
  );
}

function getTaskTypeTotals(days) {
  const totals = {};

  days.forEach((day) => {
    day.Laura.forEach((item) => {
      if (!totals[item.name]) {
        totals[item.name] = { total: 0, Laura: 0, Dino: 0 };
      }
      totals[item.name].total += 1;
      totals[item.name].Laura += 1;
    });

    day.Dino.forEach((item) => {
      if (!totals[item.name]) {
        totals[item.name] = { total: 0, Laura: 0, Dino: 0 };
      }
      totals[item.name].total += 1;
      totals[item.name].Dino += 1;
    });
  });

  return Object.entries(totals).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "de"));
}

function isCompletedBeforeNoon(detail, iso) {
  if (!detail?.completedAt) {
    return false;
  }

  const completedAt = new Date(detail.completedAt);
  if (Number.isNaN(completedAt.getTime())) {
    return false;
  }

  return toIsoDate(completedAt) === iso && completedAt.getHours() < 12;
}

function isCompletedAfterEvening(detail, iso) {
  if (!detail?.completedAt) {
    return false;
  }

  const completedAt = new Date(detail.completedAt);
  if (Number.isNaN(completedAt.getTime())) {
    return false;
  }

  return toIsoDate(completedAt) === iso && completedAt.getHours() >= 18;
}

function getUnlockedStickerIds(schedule) {
  const unlocked = new Set();
  const todayIso = toIsoDate(new Date());
  const relevantDays = schedule.filter((day) => day.iso >= todayIso);
  const completedEntries = getCompletedEntries(relevantDays).filter((entry) => {
    if (!entry.completedAt) {
      return false;
    }

    return toIsoDate(new Date(entry.completedAt)) >= todayIso;
  });

  relevantDays.forEach((day) => {
    const allItems = [...day.Laura, ...day.Dino].filter((item) => item.name !== getEveningCleanupDisplayName());
    if (allItems.length > 0 && allItems.every((item) => completions[item.key])) {
      unlocked.add("alles-geschafft");
    }

    people.forEach((person) => {
      const personItems = day[person];
      if (
        personItems.length > 0 &&
        personItems.some((item) => item.name !== getEveningCleanupDisplayName() && completions[item.key] && isCompletedBeforeNoon(completionDetails[item.key], day.iso))
      ) {
        unlocked.add("fruehstarter");
      }

      if (
        personItems.length > 0 &&
        personItems.some((item) => item.name !== getEveningCleanupDisplayName() && completions[item.key] && isCompletedAfterEvening(completionDetails[item.key], day.iso))
      ) {
        unlocked.add("abendfleiss");
      }
    });
  });

  for (let index = 0; index <= relevantDays.length - 7; index += 1) {
    const weekSlice = relevantDays.slice(index, index + 7);
    const completedWeek = weekSlice.every((day) => {
      const allItems = [...day.Laura, ...day.Dino].filter((item) => item.name !== getEveningCleanupDisplayName());
      return allItems.length > 0 && allItems.every((item) => completions[item.key]);
    });

    if (completedWeek) {
      unlocked.add("wochenwunder");
      break;
    }
  }

  if (completedEntries.filter((entry) => entry.name.startsWith("staubsaugen")).length >= 3) {
    unlocked.add("staubjaeger");
  }

  if (completedEntries.filter((entry) => entry.name === "Küche putzen").length >= 3) {
    unlocked.add("glanzkueche");
  }

  if (completedEntries.filter((entry) => entry.name === "Bad putzen").length >= 3) {
    unlocked.add("badzauber");
  }

  if (completedEntries.filter((entry) => entry.name === "staubsaugen + Boden nass").length >= 2) {
    unlocked.add("wischprofi");
  }

  const sharedDays = relevantDays.filter((day) => {
    const lauraDone = day.Laura.some((item) => item.name !== getEveningCleanupDisplayName() && completions[item.key]);
    const dinoDone = day.Dino.some((item) => item.name !== getEveningCleanupDisplayName() && completions[item.key]);
    return lauraDone && dinoDone;
  }).length;

  if (sharedDays >= 3) {
    unlocked.add("teamgeist");
  }

  return unlocked;
}

function getSeenStickerIds() {
  return new Set(stickerSeenState[currentPerson] || []);
}

function getNewStickerCount(schedule) {
  const unlocked = getUnlockedStickerIds(schedule);
  const seen = getSeenStickerIds();
  let count = 0;

  unlocked.forEach((id) => {
    if (!seen.has(id)) {
      count += 1;
    }
  });

  return count;
}

function renderStickerBadge(schedule) {
  const badge = document.getElementById("sticker-unread-badge");
  if (!badge) {
    return;
  }

  const count = getNewStickerCount(schedule);
  badge.textContent = count > 9 ? "9+" : String(count);
  badge.classList.toggle("hidden", count === 0);
}

function markUnlockedStickersAsSeen(schedule) {
  const unlocked = Array.from(getUnlockedStickerIds(schedule));
  stickerSeenState[currentPerson] = unlocked;
  saveLocalStickerSeenState();
}

function buildPostponementLookup(schedule) {
  const lookup = new Map();
  schedule.forEach((day) => {
    day.Laura.forEach((item) => {
      lookup.set(item.key, { ...item, person: "Laura" });
    });
    day.Dino.forEach((item) => {
      lookup.set(item.key, { ...item, person: "Dino" });
    });
  });
  return lookup;
}

function getKassaTotals(schedule) {
  const lookup = buildPostponementLookup(schedule);
  const totals = { Laura: 0, Dino: 0, total: 0, count: 0 };

  Object.keys(postponements).forEach((itemKey) => {
    const item = lookup.get(itemKey);
    if (!item || !people.includes(item.person)) {
      return;
    }

    totals[item.person] += 2;
    totals.total += 2;
    totals.count += 1;
  });

  return totals;
}

function animateKassaDeposit() {}

function animateKassaRestore() {}

function buildStats(schedule) {
  const taskTypeTotals = getTaskTypeTotals(schedule);
  const skyClass = `weather-scene weather-scene-${getWeatherSceneKey()}`;
  const kassa = getKassaTotals(schedule);

  return `
    <section class="stats-grid">
      <article class="stat-box kassa-card stats-sky-card ${skyClass}" id="kassa-card">
        <div class="kassa-head">
          <span class="label">Kassa</span>
          <strong>${kassa.total.toFixed(2).replace(".", ",")} €</strong>
        </div>
        <div class="piggy-stage" aria-hidden="true">
          <img class="piggy-bank-image" src="./Kawaii rosa Sparschwein mit Sternen.png" alt="Sparschwein" />
        </div>
        <div class="kassa-meta">
          <p><span class="kassa-dot laura-dot"></span>Laura: ${kassa.Laura.toFixed(2).replace(".", ",")} €</p>
          <p><span class="kassa-dot dino-dot"></span>Dino: ${kassa.Dino.toFixed(2).replace(".", ",")} €</p>
        </div>
      </article>
    </section>
    <section class="stats-task-types">
      <div class="stats-section-head">
        <span class="label">Pro Aufgabe</span>
      </div>
      <div class="stats-task-list">
        ${taskTypeTotals
          .map(([name, totals]) => {
            const isExpanded = expandedTaskStat === name;
            return `
              <article class="task-stat-card ${isExpanded ? "open" : ""}">
                <button class="task-stat-row task-stat-toggle" type="button" data-task-stat="${name}" aria-expanded="${isExpanded}">
                  <span>${name}</span>
                  <strong>${totals.total}</strong>
                </button>
                <section class="task-stat-detail ${isExpanded ? "" : "hidden"}">
                  <p>Laura: ${totals.Laura}</p>
                  <p>Dino: ${totals.Dino}</p>
                </section>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}
function renderChat() {
  const container = document.getElementById("chat-messages");

  if (!container) {
    return;
  }

  if (!chatMessages.length) {
    container.innerHTML = '<p class="empty">Noch keine Nachrichten.</p>';
    renderChatBadge();
    return;
  }

  container.innerHTML = chatMessages
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((message) => {
      const ownMessage = message.person === currentPerson;
      return `
        <article class="chat-row ${ownMessage ? "own-row" : "other-row"}">
          <div class="chat-message ${ownMessage ? "own-message" : ""}">
            <div class="chat-message-head">
              <strong>${message.person}</strong>
              <span>${chatTimeFormatter.format(new Date(message.createdAt))}</span>
            </div>
            <p>${message.message}</p>
          </div>
        </article>
      `;
    })
    .join("");

  container.scrollTop = container.scrollHeight;
  markChatAsReadIfVisible();
  renderChatBadge();
}

function getUnreadChatCount() {
  const lastReadAt = chatReadState[currentPerson] || null;

  return chatMessages.filter((message) => {
    if (message.person === currentPerson) {
      return false;
    }

    if (!lastReadAt) {
      return true;
    }

    return new Date(message.createdAt) > new Date(lastReadAt);
  }).length;
}

function renderChatBadge() {
  const badge = document.getElementById("chat-unread-badge");
  if (!badge) {
    return;
  }

  const unreadCount = getUnreadChatCount();
  badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
  badge.classList.toggle("hidden", unreadCount === 0);
}

function markChatAsRead() {
  const latestIncoming = chatMessages
    .filter((message) => message.person !== currentPerson)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  if (!latestIncoming) {
    return;
  }

  chatReadState[currentPerson] = latestIncoming.createdAt;
  saveLocalChatReadState();
}

function markChatAsReadIfVisible() {
  const panel = document.getElementById("chat-panel");
  if (!panel || panel.classList.contains("hidden")) {
    return;
  }

  if (getUnreadChatCount() === 0) {
    return;
  }

  markChatAsRead();
}

function renderStickers(schedule) {
  const container = document.getElementById("stickers-panel-content");
  if (!container) {
    return;
  }

  const unlockedStickerIds = getUnlockedStickerIds(schedule);
  renderStickerBadge(schedule);

  container.innerHTML = `
    <section class="stickers-grid">
      ${stickers
        .map(
          (sticker) => `
            <button class="sticker-tile ${unlockedStickerIds.has(sticker.id) ? "" : "locked"}" type="button" data-sticker-id="${sticker.id}" ${unlockedStickerIds.has(sticker.id) ? "" : 'disabled aria-disabled="true"'}>
              <img src="${sticker.src}" alt="${sticker.title}" />
            </button>
          `
        )
        .join("")}
    </section>
  `;

  container.querySelectorAll(".sticker-tile").forEach((button) => {
    button.addEventListener("click", () => {
      const sticker = stickers.find((item) => item.id === button.dataset.stickerId);
      if (!sticker) {
        return;
      }

      openStickerModal(sticker);
      markUnlockedStickersAsSeen(schedule);
      renderStickerBadge(schedule);
    });
  });
}

function openStickerModal(sticker, unlocked = false) {
  const modal = document.getElementById("sticker-modal");
  const image = document.getElementById("sticker-modal-image");
  const title = document.getElementById("sticker-modal-title");
  const card = document.querySelector(".sticker-modal-card");

  if (!modal || !image || !title || !card) {
    return;
  }

  image.src = sticker.src;
  image.alt = sticker.title;
  title.textContent = unlocked ? `${sticker.title} freigeschaltet!` : sticker.title;
  card.classList.remove("unlock-pop");
  if (unlocked) {
    void card.offsetWidth;
    card.classList.add("unlock-pop");
  }
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeStickerModal() {
  const modal = document.getElementById("sticker-modal");
  const card = document.querySelector(".sticker-modal-card");
  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  card?.classList.remove("unlock-pop");
}

function openTaskActionModal(item) {
  const modal = document.getElementById("task-action-modal");
  const title = document.getElementById("task-action-title");
  const postponeButton = document.getElementById("task-action-postpone");
  const restoreButton = document.getElementById("task-action-restore");
  const completeButton = document.getElementById("task-action-complete");
  const cancelButtons = document.querySelectorAll("[data-task-action-cancel]");

  if (!modal || !title || !postponeButton || !restoreButton || !completeButton) {
    return Promise.resolve("cancel");
  }

  title.textContent = `${item.person}: ${item.name}`;
  const canPostpone = isPostponableItem(item);
  const canRestore = Boolean(postponements[item.key]);
  postponeButton.classList.toggle("hidden", !canPostpone);
  restoreButton.classList.toggle("hidden", !canRestore);
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    const cleanup = (result) => {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      completeButton.removeEventListener("click", onComplete);
      postponeButton.removeEventListener("click", onPostpone);
      restoreButton.removeEventListener("click", onRestore);
      cancelButtons.forEach((button) => button.removeEventListener("click", onCancel));
      resolve(result);
    };

    const onComplete = () => cleanup("complete");
    const onPostpone = () => cleanup("postpone");
    const onRestore = () => cleanup("restore");
    const onCancel = () => cleanup("cancel");

    completeButton.addEventListener("click", onComplete);
    postponeButton.addEventListener("click", onPostpone);
    restoreButton.addEventListener("click", onRestore);
    cancelButtons.forEach((button) => button.addEventListener("click", onCancel));
  });
}

function describeRecurrence(task) {
  if (isEveningCleanupTask(task)) {
    return `Ab ${task.startDate} | täglich | Wechsel ab 18 Uhr | Start: ${task.firstPerson}`;
  }

  const units = {
    days: task.interval === 1 ? "jeden Tag" : `alle ${task.interval} Tage`,
    weeks: task.interval === 1 ? "jede Woche" : `alle ${task.interval} Wochen`,
    months: task.interval === 1 ? "jeden Monat" : `alle ${task.interval} Monate`,
  };

  return `Ab ${task.startDate} | ${units[task.unit]} | Start: ${task.firstPerson}`;
}

function getTaskDisplayName(task) {
  if (isEveningCleanupTask(task)) {
    return getEveningCleanupDisplayName();
  }

  if (task.seedKey === "seed-2") {
    return "staubsaugen (alle vier Wochen + nass)";
  }

  return task.name;
}

function getTaskOccurrences(task, schedule) {
  const occurrences = [];

  schedule.forEach((day) => {
    day.Laura.forEach((item) => {
      if (item.taskId === task.id) {
        occurrences.push({ iso: day.iso, person: "Laura", name: item.name });
      }
    });

    day.Dino.forEach((item) => {
      if (item.taskId === task.id) {
        occurrences.push({ iso: day.iso, person: "Dino", name: item.name });
      }
    });
  });

  return occurrences;
}

function buildTaskCalendar(task, schedule) {
  const occurrences = getTaskOccurrences(task, schedule);
  const occurrenceMap = new Map(occurrences.map((entry) => [entry.iso, entry]));
  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const months = [];

  for (let monthOffset = 0; monthOffset < 3; monthOffset += 1) {
    const monthDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + monthOffset, 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const leadingBlankDays = (monthStart.getDay() + 6) % 7;
    const cells = [];

    for (let blank = 0; blank < leadingBlankDays; blank += 1) {
      cells.push('<span class="task-calendar-day empty-day"></span>');
    }

    for (let dayNumber = 1; dayNumber <= monthEnd.getDate(); dayNumber += 1) {
      const cellDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber);
      const iso = toIsoDate(cellDate);
      const occurrence = occurrenceMap.get(iso);
      const personClass = occurrence ? (occurrence.person === "Laura" ? "laura-mark" : "dino-mark") : "";
      const title = occurrence ? `${occurrence.person}: ${occurrence.name}` : "";

      cells.push(`
        <span class="task-calendar-day ${personClass}" title="${title}">
          ${dayNumber}
        </span>
      `);
    }

    months.push(`
      <section class="task-calendar-month">
        <div class="task-calendar-title">${titleCase(calendarMonthFormatter.format(monthDate))}</div>
        <div class="task-calendar-weekdays">
          <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
        </div>
        <div class="task-calendar-grid">
          ${cells.join("")}
        </div>
      </section>
    `);
  }

  return `
    <section class="task-calendar-wrap">
      <div class="task-calendar-legend">
        <span class="legend-pill legend-laura">Laura</span>
        <span class="legend-pill legend-dino">Dino</span>
      </div>
      <div class="task-calendar-months">
        ${months.join("")}
      </div>
    </section>
  `;
}

function renderTaskList(schedule) {
  const list = document.getElementById("custom-task-items");
  const visibleTasks =
    activeFilter === "all"
      ? tasks.filter((task) => !isLegacyFloorMopTask(task))
      : tasks.filter(
          (task) =>
            !isLegacyFloorMopTask(task) &&
            (task.firstPerson === activeFilter || task.firstPerson === oppositePerson(activeFilter))
        );

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
            <strong>${getTaskDisplayName(task)}</strong>
          </div>
          <div class="task-actions">
            <button class="edit-task" type="button" data-task-id="${task.id}">Bearbeiten</button>
            <button class="details-task" type="button" data-task-id="${task.id}" aria-expanded="${expandedTaskId === task.id}">Details</button>
            <button class="delete-task" type="button" data-task-id="${task.id}">Löschen</button>
          </div>
          <section class="task-details ${expandedTaskId === task.id ? "" : "hidden"}">
            <p>${describeRecurrence(task)}</p>
            ${buildTaskCalendar(task, schedule)}
          </section>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".edit-task").forEach((button) => {
    button.addEventListener("click", () => startEditingTask(button.dataset.taskId));
  });

  document.querySelectorAll(".details-task").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.taskId;
      expandedTaskId = expandedTaskId === taskId ? null : taskId;
      await renderApp();
    });
  });

  document.querySelectorAll(".delete-task").forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = window.confirm("Willst du diese Aufgabe wirklich löschen?");
      if (!confirmed) {
        return;
      }

      await deleteTask(button.dataset.taskId);
      if (editingTaskId === button.dataset.taskId) {
        resetTaskForm();
      }
      if (expandedTaskId === button.dataset.taskId) {
        expandedTaskId = null;
      }
      await renderApp();
    });
  });
}

function renderList(schedule) {
  const list = document.getElementById("day-list-items");
  const stats = document.getElementById("stats");
  const today = getFallbackToday(schedule);
  const visibleDays = getVisibleDays(schedule);
  const dayListDays = getDayListDays(schedule);

  stats.innerHTML = buildStats(schedule);
  if (pendingKassaAnimation === "restore") {
    animateKassaRestore();
    pendingKassaAnimation = null;
  } else if (pendingKassaAnimation) {
    animateKassaDeposit(pendingKassaAnimation);
    pendingKassaAnimation = null;
  }
  bindTaskStatToggles();
  renderTaskList(schedule);
  renderChat();
  renderStickers(schedule);
  renderDayPickerState(schedule);

  if (!dayListDays.length) {
    list.innerHTML = '<p class="empty">Für diesen Tag gibt es keine sichtbaren Aufgaben.</p>';
    return;
  }

  if (dayListMode === "past" && !selectedDayIso) {
    list.innerHTML = dayListDays
      .map((day) => {
        const items = [];
        if (activeFilter === "all" || activeFilter === "Laura") {
          day.Laura.forEach((task) => items.push(`Laura: ${completions[task.key] ? "✓ " : ""}${task.name}`));
        }
        if (activeFilter === "all" || activeFilter === "Dino") {
          day.Dino.forEach((task) => items.push(`Dino: ${completions[task.key] ? "✓ " : ""}${task.name}`));
        }

        return `
          <article class="past-day-row">
            <div class="past-day-head">
              <strong>${day.title}</strong>
              <span>${items.length} Aufgaben</span>
            </div>
            <p>${items.length ? items.join(" | ") : "Keine sichtbaren Aufgaben."}</p>
          </article>
        `;
      })
      .join("");
    return;
  }

  list.innerHTML = dayListDays
    .map((day) => {
      const lauraTasks = day.Laura.length
        ? `<ul class="task-list">${day.Laura.map((task) => `<li>${completions[task.key] ? `<s>${task.name}</s>` : task.name}</li>`).join("")}</ul>`
        : '<p class="empty">Heute nichts extra.</p>';

      const dinoTasks = day.Dino.length
        ? `<ul class="task-list">${day.Dino.map((task) => `<li>${completions[task.key] ? `<s>${task.name}</s>` : task.name}</li>`).join("")}</ul>`
        : '<p class="empty">Heute nichts extra.</p>';

      const totalDone = [...day.Laura, ...day.Dino].filter((item) => completions[item.key]).length;
      const totalTasks = day.Laura.length + day.Dino.length;

      return `
        <article class="day-card ${day.iso === today.iso ? "today" : ""}">
          <div class="day-top">
            <div>
              <p class="date-title">${day.title}</p>
            </div>
            <span class="date-badge">${day.iso === today.iso ? "Heute | " : ""}${totalDone}/${totalTasks} erledigt</span>
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

function bindTaskStatToggles() {
  document.querySelectorAll(".task-stat-toggle").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskName = button.dataset.taskStat;
      expandedTaskStat = expandedTaskStat === taskName ? null : taskName;
      await renderApp();
    });
  });
}

function renderDayPickerState(schedule) {
  const label = document.getElementById("selected-day-label");
  const resetButton = document.getElementById("reset-day-picker");
  const pastButton = document.getElementById("show-past-days");
  const pickerInput = document.getElementById("day-picker-input");
  const hasSelectedDay = Boolean(selectedDayIso);
  const selectedDayExists = hasSelectedDay && schedule.some((day) => day.iso === selectedDayIso);

  resetButton.classList.toggle("active-toggle", dayListMode === "upcoming" && !selectedDayIso);
  pastButton.classList.toggle("active-toggle", dayListMode === "past" && !selectedDayIso);

  if (!hasSelectedDay) {
    label.textContent = "";
    label.classList.add("hidden");
    pickerInput.value = toIsoDate(new Date());
    return;
  }

  label.textContent = selectedDayExists
    ? `Gewählt: ${formatSelectedDateLabel(selectedDayIso)}`
    : `Gewählt: ${selectedDayIso}`;
  label.classList.remove("hidden");
  resetButton.classList.remove("hidden");
  pickerInput.value = selectedDayIso;
}

function getFallbackToday(schedule) {
  const todayIso = toIsoDate(new Date());
  return schedule.find((day) => day.iso === todayIso) || schedule[0];
}

function getCurrentTodayDay(schedule) {
  if (!currentTodayIso) {
    return getFallbackToday(schedule);
  }

  return schedule.find((day) => day.iso === currentTodayIso) || getFallbackToday(schedule);
}

function renderToday(schedule) {
  const today = getCurrentTodayDay(schedule);
  currentTodayIso = today.iso;
  document.getElementById("today-date").textContent = today.title;
  const todaySummaryElement = document.getElementById("today-summary");
  const visibleItems = getTodayVisibleItems(today);

  if (!visibleItems.length) {
    todaySummaryElement.innerHTML = '<p class="empty">Heute sind keine Extra-Aufgaben eingeplant.</p>';
    return;
  }

  todaySummaryElement.innerHTML = visibleItems
    .map((item) => {
      const done = Boolean(completions[item.key]);
      return `
        <button class="today-task-button ${done ? "done" : ""}" type="button" data-completion-key="${item.key}" data-done="${done ? "true" : "false"}">
          <span class="${done ? "done-text" : ""}">${item.person}: ${item.name}</span>
        </button>
      `;
    })
    .join("");

  todaySummaryElement.querySelectorAll(".today-task-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const isDone = button.dataset.done === "true";
      const nextValue = !isDone;
      const item = visibleItems.find((entry) => entry.key === button.dataset.completionKey);

      if (nextValue) {
        const action = isPostponableItem(item)
          ? await openTaskActionModal(item)
          : (window.confirm("Ist diese Aufgabe wirklich erledigt?") ? "complete" : "cancel");

        if (action === "cancel") {
          return;
        }

        if (action === "postpone") {
          postponements[item.key] = addOneDay(today.iso);
          saveLocalPostponements();
          pendingKassaAnimation = item.person;
          playPiggyBankSound();
          await renderApp();
          return;
        }

        if (action === "restore") {
          delete postponements[item.key];
          saveLocalPostponements();
          pendingKassaAnimation = "restore";
          playPiggyBankRestoreSound();
          await renderApp();
          return;
        }
      }

      const unlockedBefore = getUnlockedStickerIds(schedule);
      await setCompletion(button.dataset.completionKey, nextValue, item);
      const unlockedAfter = getUnlockedStickerIds(schedule);
      const newlyUnlocked = stickers.find((sticker) => !unlockedBefore.has(sticker.id) && unlockedAfter.has(sticker.id));

      if (nextValue) {
        if (newlyUnlocked) {
          triggerStickerUnlock(newlyUnlocked, button);
        } else {
          triggerCompletionBurst(button);
        }
      }
      await renderApp();
    });
  });
}

function triggerCompletionBurst(originElement, withSound = true) {
  const rect = originElement.getBoundingClientRect();
  const burst = document.createElement("div");
  burst.className = "completion-burst";
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;

  const colors = ["#ff8fb1", "#ffd166", "#a5e36e", "#8ec5ff", "#d6b3ff", "#ffb86b"];

  for (let index = 0; index < 28; index += 1) {
    const particle = document.createElement("span");
    particle.className = "burst-particle";
    particle.style.setProperty("--dx", `${Math.cos((Math.PI * 2 * index) / 28) * (58 + (index % 4) * 22)}px`);
    particle.style.setProperty("--dy", `${Math.sin((Math.PI * 2 * index) / 28) * (58 + (index % 5) * 20)}px`);
    particle.style.setProperty("--particle-color", colors[index % colors.length]);
    particle.style.animationDelay = `${(index % 7) * 0.018}s`;
    burst.appendChild(particle);
  }

  document.body.appendChild(burst);
  if (withSound) {
    playCompletionSound();
  }
  window.setTimeout(() => burst.remove(), 1000);
}

function triggerGrandFirework(originElement) {
  const rect = originElement.getBoundingClientRect();
  const burst = document.createElement("div");
  burst.className = "completion-burst grand-burst";
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;

  const colors = ["#ff7eb6", "#ffd86b", "#8ec5ff", "#d6b3ff", "#ffb86b", "#fff0a8", "#9df2c3"];

  for (let index = 0; index < 54; index += 1) {
    const particle = document.createElement("span");
    particle.className = "burst-particle";
    particle.style.setProperty("--dx", `${Math.cos((Math.PI * 2 * index) / 54) * (96 + (index % 6) * 26)}px`);
    particle.style.setProperty("--dy", `${Math.sin((Math.PI * 2 * index) / 54) * (96 + (index % 7) * 24)}px`);
    particle.style.setProperty("--particle-color", colors[index % colors.length]);
    particle.style.animationDelay = `${(index % 9) * 0.018}s`;
    burst.appendChild(particle);
  }

  document.body.appendChild(burst);
  window.setTimeout(() => burst.remove(), 1400);
}

function triggerStickerUnlock(sticker, originElement) {
  triggerGrandFirework(originElement);
  playStickerUnlockSound();
  openStickerModal(sticker, true);
}

function playCompletionSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const notes = [
    { frequency: 740, duration: 0.08, delay: 0 },
    { frequency: 980, duration: 0.09, delay: 0.06 },
    { frequency: 1240, duration: 0.12, delay: 0.12 },
  ];

  const now = audioContext.currentTime;

  notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(note.frequency, now + note.delay);

    gain.gain.setValueAtTime(0.0001, now + note.delay);
    gain.gain.exponentialRampToValueAtTime(0.08, now + note.delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + note.delay);
    oscillator.stop(now + note.delay + note.duration);
  });

  window.setTimeout(() => {
    audioContext.close().catch(() => {});
  }, 450);
}

function playPiggyBankSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const notes = [
    { frequency: 1120, duration: 0.045, delay: 0, type: "triangle", volume: 0.08 },
    { frequency: 860, duration: 0.09, delay: 0.055, type: "sine", volume: 0.06 },
    { frequency: 520, duration: 0.16, delay: 0.11, type: "triangle", volume: 0.05 },
  ];

  const now = audioContext.currentTime;

  notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, now + note.delay);

    gain.gain.setValueAtTime(0.0001, now + note.delay);
    gain.gain.exponentialRampToValueAtTime(note.volume, now + note.delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + note.delay);
    oscillator.stop(now + note.delay + note.duration);
  });

  window.setTimeout(() => {
    audioContext.close().catch(() => {});
  }, 420);
}

function playPiggyBankRestoreSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const notes = [
    { frequency: 520, duration: 0.08, delay: 0, type: "triangle", volume: 0.045 },
    { frequency: 420, duration: 0.12, delay: 0.07, type: "sine", volume: 0.03 },
  ];

  const now = audioContext.currentTime;

  notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, now + note.delay);

    gain.gain.setValueAtTime(0.0001, now + note.delay);
    gain.gain.exponentialRampToValueAtTime(note.volume, now + note.delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + note.delay);
    oscillator.stop(now + note.delay + note.duration);
  });

  window.setTimeout(() => {
    audioContext.close().catch(() => {});
  }, 300);
}

function playStickerUnlockSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const notes = [
    { frequency: 659, duration: 0.12, delay: 0, type: "triangle", gain: 0.06 },
    { frequency: 988, duration: 0.14, delay: 0.08, type: "triangle", gain: 0.08 },
    { frequency: 1319, duration: 0.18, delay: 0.17, type: "sine", gain: 0.09 },
    { frequency: 1760, duration: 0.24, delay: 0.29, type: "sine", gain: 0.11 },
    { frequency: 2093, duration: 0.28, delay: 0.42, type: "sine", gain: 0.09 },
  ];

  const now = audioContext.currentTime;

  notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, now + note.delay);
    gain.gain.setValueAtTime(0.0001, now + note.delay);
    gain.gain.exponentialRampToValueAtTime(note.gain, now + note.delay + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + note.delay);
    oscillator.stop(now + note.delay + note.duration);
  });

  window.setTimeout(() => {
    audioContext.close().catch(() => {});
  }, 1100);
}

async function renderApp() {
  const schedule = buildSchedule();
  renderHeroWeather();
  renderToday(schedule);
  renderList(schedule);
}

function getTodayVisibleItems(today) {
  const lauraItems = [];
  const dinoItems = [];
  const cleanupTask = tasks.find((task) => isEveningCleanupTask(task));

  if (activeFilter === "all" || activeFilter === "Laura") {
    today.Laura
      .filter((item) => !cleanupTask || item.taskId !== cleanupTask.id)
      .forEach((item) => lauraItems.push({ ...item, person: "Laura" }));
  }
  if (activeFilter === "all" || activeFilter === "Dino") {
    today.Dino
      .filter((item) => !cleanupTask || item.taskId !== cleanupTask.id)
      .forEach((item) => dinoItems.push({ ...item, person: "Dino" }));
  }

  if (cleanupTask) {
    const currentCleanup = getCurrentCleanupAssignment(cleanupTask, today.iso);
    if (currentCleanup.person === "Laura") {
      if (activeFilter === "all" || activeFilter === "Laura") {
        lauraItems.unshift(currentCleanup);
      }
    } else if (activeFilter === "all" || activeFilter === "Dino") {
      dinoItems.unshift(currentCleanup);
    }
  }

  return [...lauraItems, ...dinoItems];
}

function bindFilters() {
  const chips = document.querySelectorAll(".chip");

  if (!chips.length) {
    activeFilter = "all";
    return;
  }

  chips.forEach((button) => {
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

      if (button.dataset.accordion === "chat-panel" && !isExpanded) {
        markChatAsRead();
        renderChatBadge();
      }

      if (button.dataset.accordion === "stickers-panel" && !isExpanded) {
        const schedule = buildSchedule();
        markUnlockedStickersAsSeen(schedule);
        renderStickerBadge(schedule);
      }
    });
  });
}

function bindTodayNavigation() {
  const prevButton = document.getElementById("today-prev");
  const nextButton = document.getElementById("today-next");

  prevButton.addEventListener("click", async () => {
    const schedule = buildSchedule();
    const currentDay = getCurrentTodayDay(schedule);
    const currentIndex = schedule.findIndex((day) => day.iso === currentDay.iso);
    const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    currentTodayIso = schedule[nextIndex].iso;
    await renderApp();
  });

  nextButton.addEventListener("click", async () => {
    const schedule = buildSchedule();
    const currentDay = getCurrentTodayDay(schedule);
    const currentIndex = schedule.findIndex((day) => day.iso === currentDay.iso);
    const nextIndex = currentIndex < schedule.length - 1 ? currentIndex + 1 : schedule.length - 1;
    currentTodayIso = schedule[nextIndex].iso;
    await renderApp();
  });
}

function bindDayPicker() {
  const openButton = document.getElementById("open-day-picker");
  const pickerInput = document.getElementById("day-picker-input");
  const pickerWrap = document.getElementById("day-picker-wrap");
  const resetButton = document.getElementById("reset-day-picker");
  const pastButton = document.getElementById("show-past-days");

  openButton.addEventListener("click", () => {
    if (!pickerInput.value) {
      pickerInput.value = selectedDayIso || toIsoDate(new Date());
    }

    if (typeof pickerInput.showPicker === "function") {
      pickerWrap.classList.remove("hidden");
      pickerInput.showPicker();
      return;
    }

    const willOpen = pickerWrap.classList.contains("hidden");
    pickerWrap.classList.toggle("hidden");

    if (willOpen) {
      pickerInput.focus();
    }
  });

  pickerInput.addEventListener("change", async () => {
    dayListMode = "upcoming";
    selectedDayIso = pickerInput.value || null;
    pickerWrap.classList.add("hidden");
    await renderApp();
  });

  resetButton.addEventListener("click", async () => {
    dayListMode = "upcoming";
    selectedDayIso = null;
    pickerInput.value = toIsoDate(new Date());
    pickerWrap.classList.add("hidden");
    await renderApp();
  });

  pastButton.addEventListener("click", async () => {
    dayListMode = "past";
    selectedDayIso = null;
    pickerInput.value = toIsoDate(new Date());
    pickerWrap.classList.add("hidden");
    await renderApp();
  });
}

function bindStickerModal() {
  const backdrop = document.getElementById("sticker-modal-backdrop");
  const image = document.getElementById("sticker-modal-image");

  if (backdrop) {
    backdrop.addEventListener("click", closeStickerModal);
  }

  if (image) {
    image.addEventListener("click", closeStickerModal);
  }
}

function bindThemeButtons() {
  const lightButton = document.getElementById("light-theme-button");
  const darkButton = document.getElementById("dark-theme-button");

  bindPress(lightButton, async () => {
    applyTheme("light");
  });

  bindPress(darkButton, async () => {
    applyTheme("dark");
  });
}

function updateMusicButton() {
  const button = document.getElementById("music-button");
  if (!button) {
    return;
  }

  button.classList.toggle("music-active", musicEnabled);
  button.setAttribute("aria-pressed", musicEnabled ? "true" : "false");
}

function ensureBackgroundMusic() {
  if (backgroundMusic) {
    return backgroundMusic;
  }

  const audio = new Audio(backgroundMusicSrc);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.22;
  backgroundMusic = audio;
  return backgroundMusic;
}

function stopBackgroundMusic() {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }
}

async function startBackgroundMusic() {
  const audio = ensureBackgroundMusic();
  audio.currentTime = 0;
  await audio.play();
}

function bindMusicButton() {
  const button = document.getElementById("music-button");
  if (!button) {
    return;
  }

  updateMusicButton();

  bindPress(button, async () => {
    musicEnabled = !musicEnabled;
    saveLocalMusicEnabled();
    updateMusicButton();

    if (musicEnabled) {
      try {
        await startBackgroundMusic();
      } catch {
        armMusicAutostart();
      }
    } else {
      stopBackgroundMusic();
    }
  });
}

function armMusicAutostart() {
  if (!musicEnabled || (backgroundMusic && !backgroundMusic.paused)) {
    return;
  }

  const startOnGesture = async () => {
    if (!musicEnabled || (backgroundMusic && !backgroundMusic.paused)) {
      return;
    }

    try {
      await startBackgroundMusic();
    } catch {}
  };

  document.addEventListener("pointerdown", startOnGesture, { once: true });
  document.addEventListener("keydown", startOnGesture, { once: true });
}

function tryStartBackgroundMusicImmediately() {
  if (!musicEnabled || (backgroundMusic && !backgroundMusic.paused)) {
    return;
  }

  startBackgroundMusic().catch(() => {
    armMusicAutostart();
  });
}

function bindIdentityButtons() {
  document.querySelectorAll(".identity-button").forEach((button) => {
    bindPress(button, async () => {
      applyPerson(button.dataset.person);
      await renderApp();
    });
  });
}

async function createChatMessage(messageText) {
  const newMessage = {
    id: `${Date.now()}-${Math.random()}`,
    person: currentPerson,
    message: messageText,
    createdAt: new Date().toISOString(),
  };

  if (!supabaseClient) {
    chatMessages.push(newMessage);
    saveLocalChatMessages();
    return;
  }

  const { error } = await supabaseClient.from("household_chat_messages").insert({
    household_id: supabaseConfig.householdId,
    person: newMessage.person,
    message: newMessage.message,
  });

  if (error) {
    chatMessages.push(newMessage);
    saveLocalChatMessages();
    return;
  }

  await loadChatMessages();
}

function bindChatForm() {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const messageText = input.value.trim();
    if (!messageText) {
      return;
    }

    await createChatMessage(messageText);
    input.value = "";
    await renderApp();
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

async function setCompletion(completionKey, done, item) {
  completions[completionKey] = done;
  if (done) {
    completionDetails[completionKey] = {
      completedAt: new Date().toISOString(),
      person: item?.person || null,
      name: item?.name || null,
      iso: currentTodayIso || null,
    };
  } else {
    delete completionDetails[completionKey];
  }

  if (!supabaseClient) {
    saveLocalCompletions();
    saveLocalCompletionDetails();
    return;
  }

  const { error } = await supabaseClient.from("household_task_completions").upsert(
    {
      household_id: supabaseConfig.householdId,
      completion_key: completionKey,
      done,
    },
    { onConflict: "household_id,completion_key" }
  );

  if (error) {
    saveLocalCompletions();
    saveLocalCompletionDetails();
    return;
  }

  saveLocalCompletions();
  saveLocalCompletionDetails();
}

function startEditingTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  editingTaskId = task.id;
  document.getElementById("task-form").classList.remove("hidden");
  document.getElementById("show-task-form").classList.add("hidden");
  document.getElementById("task-id").value = task.id;
  document.getElementById("task-name").value = task.name;
  document.getElementById("task-start-date").value = task.startDate;
  document.querySelector('#task-form select[name="unit"]').value = task.unit;
  document.querySelector('#task-form input[name="interval"]').value = task.interval;
  document.getElementById("task-submit-button").textContent = "aktualisieren";
  document.getElementById("task-close-form").textContent = "schließen";
  document.getElementById("task-cancel-edit").textContent = "abbrechen";
  document.getElementById("task-cancel-edit").classList.remove("hidden");
  document.getElementById("custom-task-list").classList.remove("hidden");
  document.querySelector('[data-accordion="custom-task-list"]').setAttribute("aria-expanded", "true");
  document.getElementById("task-name").focus();
}

function resetTaskForm() {
  editingTaskId = null;
  document.getElementById("task-form").reset();
  document.getElementById("task-form").classList.add("hidden");
  document.getElementById("show-task-form").classList.remove("hidden");
  document.getElementById("task-id").value = "";
  document.getElementById("task-start-date").value = toIsoDate(initialStartDate);
  document.querySelector('#task-form select[name="unit"]').value = "weeks";
  document.querySelector('#task-form input[name="interval"]').value = 1;
  document.getElementById("task-submit-button").textContent = "Aufgabe speichern";
  document.getElementById("task-close-form").textContent = "schließen";
  document.getElementById("task-cancel-edit").textContent = "abbrechen";
  document.getElementById("task-cancel-edit").classList.add("hidden");
}

function bindTaskForm() {
  const taskSection = document.getElementById("custom-task-list");
  const taskToggle = document.querySelector('[data-accordion="custom-task-list"]');
  const form = document.getElementById("task-form");
  const dateInput = document.getElementById("task-start-date");
  const cancelButton = document.getElementById("task-cancel-edit");
  const closeButton = document.getElementById("task-close-form");
  const showButton = document.getElementById("show-task-form");

  dateInput.value = toIsoDate(initialStartDate);
  document.getElementById("task-close-form").textContent = "schließen";
  document.getElementById("task-cancel-edit").textContent = "abbrechen";

  showButton.addEventListener("click", () => {
    form.classList.remove("hidden");
    showButton.classList.add("hidden");
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

  closeButton.addEventListener("click", () => {
    resetTaskForm();
  });

  taskSection.classList.add("hidden");
  taskToggle.setAttribute("aria-expanded", "false");
  form.classList.add("hidden");
  showButton.classList.remove("hidden");
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
    await loadCompletions();
    await loadChatMessages();
    await renderApp();
  }, syncIntervalMs);
}

function startWeatherRefresh() {
  if (weatherTimer) {
    clearInterval(weatherTimer);
  }

  weatherTimer = setInterval(async () => {
    await loadWeather();
    renderHeroWeather();
  }, weatherRefreshMs);

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
      await loadWeather();
      renderHeroWeather();
    }
  });
}

async function initApp() {
  applyTheme(loadLocalTheme());
  currentPerson = loadLocalPerson();
  completionDetails = loadLocalCompletionDetails();
  postponements = loadLocalPostponements();
  chatReadState = loadLocalChatReadState();
  stickerSeenState = loadLocalStickerSeenState();
  musicEnabled = false;
  saveLocalMusicEnabled();
  await loadWeather();
  await loadTasks();
  await loadCompletions();
  await loadChatMessages();
  currentTodayIso = toIsoDate(new Date());
  bindFilters();
  bindAccordions();
  bindTodayNavigation();
  bindDayPicker();
  bindThemeButtons();
  bindMusicButton();
  bindIdentityButtons();
  bindChatForm();
  bindTaskForm();
  bindStickerModal();
  applyPerson(currentPerson);
  updateMusicButton();
  tryStartBackgroundMusicImmediately();
  await renderApp();
  await startPolling();
  startWeatherRefresh();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }
}

window.addEventListener("DOMContentLoaded", initApp);

