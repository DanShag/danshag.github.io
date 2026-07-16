// Конфигурация звуков и настроек системы
let startupAudio = null;
let ambientAudio = null;
let audioUnlocked = false;
let startupAudioPlayed = false;
let autoplayBlocked = false;
let notificationTimeout = null;
let mouseClickAudio = null;

// Настройки подключения к Supabase (Инструкция по заполнению в database_setup_guide.md)
const SUPABASE_URL = "https://epvcpkylgqgyevirubhn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DkBPR_bs6U7hWfxObPQ95Q_msbwwV-o";
let supabaseClient = null;

const systemSettings = {
  disableGlitch: false,
  disableBoot: false,
  stretchScreen: false,
  removeOuterBg: false,
  removeWallpaper: false,
  wallpaperIndex: 0,
  nickname: "",
  disableSounds: false
};

const wallpapersList = [
  { name: "Стандартные", path: "./assets/winxp.jpg" },
  { name: "Обои 1", path: "./assets/wallpaper1.jpg" },
  { name: "Обои 2", path: "./assets/wallpaper2.jpg" },
  { name: "Обои 3", path: "./assets/wallpaper3.jpg" },
  { name: "Обои 4", path: "./assets/wallpaper4.jpg" }
];


// Проверка критического состояния системы при удалении C:
const systemIsDeleted = (document.cookie.split('; ').find(row => row.startsWith('danshag_sys_deleted='))?.split('=')[1] === 'true') || (localStorage.getItem('danshag_sys_deleted') === 'true');
if (systemIsDeleted) {
  document.addEventListener('DOMContentLoaded', () => {
    // Сразу гасим все фоны при загрузке страницы восстановления
    document.documentElement.classList.add('system-dead');
    document.body.classList.add('system-dead');
    showRecoveryPrompt();
  });
}

// ================= СИСТЕМНЫЕ НАСТРОЙКИ И ЗВУКИ =================

function loadSystemSettings() {
  const cookieVal = getCookie('danshag_settings');
  if (cookieVal) {
    try {
      const parsed = JSON.parse(decodeURIComponent(cookieVal));
      Object.assign(systemSettings, parsed);
    } catch (e) {
      console.error("Ошибка парсинга кук настроек:", e);
    }
  }
}

function saveSystemSettings() {
  setCookie('danshag_settings', encodeURIComponent(JSON.stringify(systemSettings)), 365);
}

function applySystemSettings() {
  const wallpaper = document.querySelector('.desktop-wallpaper');
  const bezel = document.querySelector('.monitor-bezel');
  const removeOuterBgCheckbox = document.getElementById('setting-remove-outer-bg');

  const gl = document.getElementById('setting-disable-glitch');
  const bo = document.getElementById('setting-disable-boot');
  const st = document.getElementById('setting-stretch-screen');
  const bg = document.getElementById('setting-remove-outer-bg');
  const wa = document.getElementById('setting-remove-wallpaper');
  const wpName = document.getElementById('setting-wallpaper-name');
  const snd = document.getElementById('setting-disable-sounds');

  // 1. Глитч-эффекты на обоях
  if (wallpaper) {
    if (systemSettings.disableGlitch) {
      wallpaper.style.animation = 'none';
    } else {
      wallpaper.style.animation = 'wallpaper-squish-glitch 5s infinite steps(2) alternate';
    }
  }

  // 2. Растягивание экрана
  if (bezel) {
    if (systemSettings.stretchScreen) {
      bezel.classList.add('stretched');
      // Если включено растягивание, функция "Убрать фон" недоступна
      if (removeOuterBgCheckbox) {
        removeOuterBgCheckbox.disabled = true;
        removeOuterBgCheckbox.checked = false;
      }
      document.body.classList.remove('no-outer-bg');
    } else {
      bezel.classList.remove('stretched');
      if (removeOuterBgCheckbox) {
        removeOuterBgCheckbox.disabled = false;
        removeOuterBgCheckbox.checked = systemSettings.removeOuterBg;
      }
      if (systemSettings.removeOuterBg) {
        document.body.classList.add('no-outer-bg');
      } else {
        document.body.classList.remove('no-outer-bg');
      }
    }
  }

  // 3. Отключение внешнего фона
  if (!systemSettings.stretchScreen && systemSettings.removeOuterBg) {
    document.body.classList.add('no-outer-bg');
  } else {
    document.body.classList.remove('no-outer-bg');
  }

  // 4. Отключение/смена обоев
  if (wallpaper) {
    if (systemSettings.removeWallpaper) {
      wallpaper.classList.add('no-wallpaper');
      wallpaper.style.backgroundImage = 'none';
      wallpaper.style.backgroundColor = '#000000';
    } else {
      wallpaper.classList.remove('no-wallpaper');
      const activeWp = wallpapersList[systemSettings.wallpaperIndex];
      wallpaper.style.backgroundImage = `url('${activeWp.path}')`;
    }

    // ПРИМЕНЕНИЕ НИКНЕЙМА:
    const nickInput = document.getElementById('setting-nickname');
    if (nickInput) {
      nickInput.value = systemSettings.nickname || "";
    }
    const welcomeSpan = document.getElementById('welcome-username');
    if (welcomeSpan) {
      welcomeSpan.textContent = (systemSettings.nickname && systemSettings.nickname.trim() !== "") ? systemSettings.nickname : "путник";
    }
  }

  // 5. Включение/выключение звуков
  if (systemSettings.disableSounds) {
    if (startupAudio) startupAudio.pause();
    if (ambientAudio) ambientAudio.pause();
  } else {
    if (audioUnlocked) {
      const bootScreen = document.getElementById('boot-screen');
      const bootScreenActive = bootScreen && bootScreen.style.display !== 'none';
      if (!bootScreenActive) {
        playAmbientSound();
      }
    }
  }

  // Обновляем визуальное состояние иконки звука на рабочем столе
  const muteIconBtn = document.getElementById('icon-mute-sounds');
  const muteLine = document.querySelector('#icon-mute-sounds .sound-mute-line');
  const soundWaves = document.querySelectorAll('#icon-mute-sounds .sound-wave');
  const muteLabel = document.getElementById('mute-icon-label');

  if (systemSettings.disableSounds) {
    if (muteLine) muteLine.style.display = 'block';
    soundWaves.forEach(w => w.style.display = 'none');
    if (muteLabel) muteLabel.textContent = 'Звук: Выкл';
    if (muteIconBtn) muteIconBtn.classList.add('muted');
  } else {
    if (muteLine) muteLine.style.display = 'none';
    soundWaves.forEach(w => w.style.display = 'block');
    if (muteLabel) muteLabel.textContent = 'Звук: Вкл';
    if (muteIconBtn) muteIconBtn.classList.remove('muted');
  }

  // Обновление интерфейса панели настроек
  if (gl) gl.checked = systemSettings.disableGlitch;
  if (bo) bo.checked = systemSettings.disableBoot;
  if (st) st.checked = systemSettings.stretchScreen;
  if (bg) bg.checked = systemSettings.removeOuterBg;
  if (wa) wa.checked = systemSettings.removeWallpaper;
  if (snd) snd.checked = systemSettings.disableSounds;
  if (wpName) wpName.textContent = wallpapersList[systemSettings.wallpaperIndex].name;
}

function toggleMuteSounds() {
  systemSettings.disableSounds = !systemSettings.disableSounds;
  saveSystemSettings();
  applySystemSettings();
}

// Звуковое сопровождение
function playStartupSound() {
  if (systemSettings.disableSounds) return;
  if (startupAudioPlayed) return;

  if (!startupAudio) {
    startupAudio = new Audio('assets/startup.mp3');
  }
  startupAudio.play()
    .then(() => {
      startupAudioPlayed = true;
      startupAudio.onended = playAmbientSound;
    })
    .catch(e => {
      console.log("Браузер заблокировал автовоспроизведение:", e);
      autoplayBlocked = true;
    });
}

function playAmbientSound() {
  // Если звук запуска всё ещё играет, ставим его на паузу
  if (startupAudio) {
    startupAudio.pause();
  }
  if (systemSettings.disableSounds) return;
  if (!ambientAudio) {
    ambientAudio = new Audio('assets/ambient_hum.mp3');
    ambientAudio.loop = true;
  }
  ambientAudio.play().catch(e => console.log("Не удалось запустить фоновый гул:", e));
}

function playMouseClickSound() {
  if (systemSettings.disableSounds || !audioUnlocked) return;
  if (!mouseClickAudio) {
    mouseClickAudio = new Audio('assets/clickmouse.mp3');
  }
  mouseClickAudio.currentTime = 0;
  mouseClickAudio.play().catch(e => console.log("Не удалось воспроизвести звук клика мыши:", e));
}

function playKeyboardClickSound() {
  if (systemSettings.disableSounds || !audioUnlocked) return;
  const sound = new Audio('assets/clickkeyboard.mp3');
  sound.play().catch(e => console.log("Не удалось воспроизвести звук клавиатуры:", e));
}

// Симуляция запуска системы (BIOS)
function startSystemBoot() {
  const bootScreen = document.getElementById('boot-screen');

  if (systemSettings.disableBoot) {
    if (bootScreen) bootScreen.style.display = 'none';
    playAmbientSound();
    onSystemReady();
    return;
  }

  if (bootScreen) {
    bootScreen.style.display = 'flex';
  }

  playStartupSound();

  const logContainer = document.getElementById('bios-log');
  if (!logContainer) return;
  logContainer.innerHTML = '';

  const biosLines = [
    "BIOS Version 1.04.26 - Shinshila Soft (C) 2026",
    "CPU: AMD Ryzen 7 1700X Eight-Core Processor @ 3.85 GHz",
    "Memory Test: 32768 MB OK",
    "Detecting Primary Master ... Toshiba 500GB HDD [S.M.A.R.T. OK]",
    "Detecting Secondary Master ... XPG SPECTRIX S40G NVMe SSD",
    "Keyboard ..... Detected",
    "Mouse ........ Detected",
    "Loading kernel modules ...",
    "  hal.dll .................... OK",
    "  ntoskrnl.exe ............... OK",
    "  [WARNING] ds_audio.sys signature check failed. Loading anyway...",
    "All subsystems initialized successfully.",
    "Launching DanShag OS..."
  ];

  let lineIndex = 0;

  function printNextLine() {
    if (lineIndex < biosLines.length) {
      const p = document.createElement('div');
      p.textContent = biosLines[lineIndex];
      logContainer.appendChild(p);
      lineIndex++;
      const delay = Math.random() * 300 + 100; // Слегка ускорили вывод для динамичности
      setTimeout(printNextLine, delay);
    } else {
      // Переход на загрузочный экран OS (XP стиль)
      const osLoading = document.getElementById('os-loading');
      if (osLoading) {
        const welcomeText = document.getElementById('xp-welcome-text');
        if (welcomeText) {
          const nick = (systemSettings.nickname && systemSettings.nickname.trim() !== "") ? systemSettings.nickname : "путник";
          welcomeText.textContent = `Добро пожаловать, ${nick}!`;
        }
        osLoading.style.display = 'flex';
        setTimeout(() => {
          fadeOutBootScreen();
        }, 1500);
      } else {
        fadeOutBootScreen();
      }
    }
  }

  setTimeout(printNextLine, 500);
}

function fadeOutBootScreen() {
  const bootScreen = document.getElementById('boot-screen');
  const osLoading = document.getElementById('os-loading');
  if (bootScreen) {
    bootScreen.style.transition = 'opacity 0.8s ease';
    bootScreen.style.opacity = '0';
    setTimeout(() => {
      bootScreen.style.display = 'none';
      bootScreen.style.opacity = '1';
      if (osLoading) {
        osLoading.style.display = 'none'; // Сбрасываем загрузочный экран OS, чтобы он не числился активным
      }
      onSystemReady();
    }, 800);
  }
}

function handleSkipBoot() {
  const bootScreen = document.getElementById('boot-screen');
  const osLoading = document.getElementById('os-loading');
  if (bootScreen) {
    bootScreen.style.display = 'none';
  }
  if (osLoading) {
    osLoading.style.display = 'none';
  }
  playAmbientSound();
  onSystemReady();
}

// Снятие блокировок аудио по первому клику или клавише пользователя
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);

  const bootScreen = document.getElementById('boot-screen');
  const bootScreenActive = bootScreen && bootScreen.style.display !== 'none';

  if (bootScreenActive) {
    // Если запуск идет и звук НЕ играет (был заблокирован) — играем его.
    // Если звук уже играет (успешный автозапуск) — НИЧЕГО не делаем, не сбиваем его на эмбиент!
    if (!startupAudioPlayed) {
      playStartupSound();
    }
  } else {
    playAmbientSound();
  }

  // Скрываем предупреждение при успешном клике/разблокировке звука
  autoplayBlocked = false;
  const trayIcon = document.getElementById('tray-volume-warning');
  if (trayIcon) {
    trayIcon.style.display = 'none';
  }
  closeAutoplayNotification();
}

// Уведомление об автозапуске аудио
function onSystemReady() {
  if (autoplayBlocked) {
    const trayIcon = document.getElementById('tray-volume-warning');
    if (trayIcon) {
      trayIcon.style.display = 'flex';
    }
    showAutoplayNotification();
  }
}

function showAutoplayNotification() {
  const notif = document.getElementById('autoplay-notification');
  if (!notif) return;

  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  notif.style.display = 'block';

  // Закрытие уведомления через 5 секунд
  notificationTimeout = setTimeout(() => {
    closeAutoplayNotification();
  }, 5000);
}

function closeAutoplayNotification() {
  const notif = document.getElementById('autoplay-notification');
  if (notif) {
    notif.style.display = 'none';
  }
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
  }
}


// Коэффициент масштабирования (должен совпадать с --desktop-zoom в style.css)
const DESKTOP_ZOOM = 1.2;

// ================= ФУНКЦИИ COOKIE ДЛЯ VISIT COUNT =================

function getCookie(name) {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  } catch (e) {
    console.warn("Cookies are blocked or unavailable:", e);
  }
  try {
    return localStorage.getItem(name);
  } catch (e) {
    return null;
  }
}

function setCookie(name, value, days) {
  try {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=Strict`;
  } catch (e) {
    console.warn("Cookies are blocked or unavailable:", e);
  }
  try {
    if (value === null || value === undefined || value === "") {
      localStorage.removeItem(name);
    } else {
      localStorage.setItem(name, value);
    }
  } catch (e) {
    console.error("LocalStorage write failed:", e);
  }
}

// ================= ЛОГИКА ИНТРО =================

document.addEventListener('DOMContentLoaded', () => {

  loadSystemSettings();
  applySystemSettings();

  const introScreen = document.getElementById('intro-screen');
  const introText = document.getElementById('intro-text');

  let visitCount = parseInt(getCookie('danshag_visits') || '0', 10);
  visitCount++;
  setCookie('danshag_visits', visitCount, 365);

  // Инициализация блокнота
  loadNotepadContent();
  document.getElementById('btn-save-notepad').addEventListener('click', saveNotepadContent);
  document.getElementById('notepad-textarea').addEventListener('input', () => {
    // Автосохранение при вводе
    setCookie('danshag_notepad', encodeURIComponent(document.getElementById('notepad-textarea').value), 30);
  });

  // Инициализация плеера и командной строки
  initAudioPlayer();
  initCommandLine();

  // visitCount = 1; // Раскомментировать для отладки

  if (visitCount === 1) {
    // 1-й визит: плавный рассказ и наступление темноты
    setTimeout(() => {
      introText.textContent = "Когда станет темно";
      introScreen.classList.add('darkness-stage-1');
    }, 2000);

    setTimeout(() => {
      introText.textContent = "Затем темней";
      introScreen.classList.add('darkness-stage-2');
    }, 3000);

    setTimeout(() => {
      introText.textContent = "Ещё темнее.";
      introScreen.classList.add('darkness-stage-3');
    }, 4000);

    setTimeout(() => {
      endIntro();
    }, 5000);

  } else if (visitCount === 2) {
    // 2-й визит: сразу темно
    introScreen.classList.add('darkness-stage-3');
    introText.textContent = "Здесь слишком темно.";
    setTimeout(() => {
      endIntro();
    }, 1000);

  } else if (visitCount === 3) {
    // 3-й визит: в темноте страшно
    introScreen.classList.add('darkness-stage-3');
    introText.textContent = "В темноте страшно, не так ли?";
    setTimeout(() => {
      endIntro();
    }, 1000);

  } else if (visitCount === 4) {
    // 4-й визит: быстрый проброс "Тот эксперимент..."
    introScreen.classList.add('darkness-stage-3');
    introText.textContent = "Тот эксперимент не был провальным.";
    setTimeout(() => {
      endIntro(true); // быстрый выход без долгого фейда
    }, 150);

  } else {
    // 5-й и последующие визиты: сразу на сайт
    introScreen.style.display = 'none';
    introScreen.classList.remove('intro-active');
    // ДОБАВИТЬ СЮДА:
    startSystemBoot();
  }

  function endIntro(fast = false) {
    // Начинаем запуск системы (BIOS) сразу, чтобы под фейдящимся интро-экраном
    // уже был темный экран загрузки, а не цветной рабочий стол
    startSystemBoot();

    if (fast) {
      introScreen.style.display = 'none';
      introScreen.classList.remove('intro-active');
    } else {
      const content = document.getElementById('intro-content');
      if (content) {
        content.classList.add('intro-text-fadeout');
      }

      setTimeout(() => {
        introScreen.classList.add('intro-fadeout');
        setTimeout(() => {
          introScreen.style.display = 'none';
          introScreen.classList.remove('intro-active');
        }, 1200);
      }, 1000);
    }
  }

  // Отслеживание ввода никнейма в реальном времени
  const nickInput = document.getElementById('setting-nickname');
  if (nickInput) {
    nickInput.addEventListener('input', (e) => {
      systemSettings.nickname = e.target.value;
      saveSystemSettings();
      applySystemSettings();
    });
  }

  // 2. Слушатели клика/клавиатуры для разблокировки звука
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  document.addEventListener('mousedown', () => {
    playMouseClickSound();
  });

  document.addEventListener('keydown', (e) => {
    // Предотвращаем повтор звуков при зажатии клавиш, кроме клавиши Backspace (чтобы озвучивать каждый удаленный символ)
    if (e.repeat && e.key !== 'Backspace') return;
    playKeyboardClickSound();
  });

  // 3. Обработчики элементов формы настроек
  const glInput = document.getElementById('setting-disable-glitch');
  const boInput = document.getElementById('setting-disable-boot');
  const stInput = document.getElementById('setting-stretch-screen');
  const bgInput = document.getElementById('setting-remove-outer-bg');
  const waInput = document.getElementById('setting-remove-wallpaper');
  const sndInput = document.getElementById('setting-disable-sounds');

  if (glInput) glInput.onchange = (e) => { systemSettings.disableGlitch = e.target.checked; saveSystemSettings(); applySystemSettings(); };
  if (boInput) boInput.onchange = (e) => { systemSettings.disableBoot = e.target.checked; saveSystemSettings(); applySystemSettings(); };
  if (stInput) stInput.onchange = (e) => {
    systemSettings.stretchScreen = e.target.checked;
    if (e.target.checked) systemSettings.removeOuterBg = false; // Отключаем Убрать фон при растянутом режиме
    saveSystemSettings();
    applySystemSettings();
  };
  if (bgInput) bgInput.onchange = (e) => { systemSettings.removeOuterBg = e.target.checked; saveSystemSettings(); applySystemSettings(); };
  if (waInput) waInput.onchange = (e) => { systemSettings.removeWallpaper = e.target.checked; saveSystemSettings(); applySystemSettings(); };
  if (sndInput) sndInput.onchange = (e) => { systemSettings.disableSounds = e.target.checked; saveSystemSettings(); applySystemSettings(); };

  // 4. Кнопки смены обоев
  const wpPrev = document.getElementById('setting-wallpaper-prev');
  const wpNext = document.getElementById('setting-wallpaper-next');

  if (wpPrev) wpPrev.onclick = () => {
    systemSettings.wallpaperIndex--;
    if (systemSettings.wallpaperIndex < 0) systemSettings.wallpaperIndex = wallpapersList.length - 1;
    saveSystemSettings();
    applySystemSettings();
  };
  if (wpNext) wpNext.onclick = () => {
    systemSettings.wallpaperIndex++;
    if (systemSettings.wallpaperIndex >= wallpapersList.length) systemSettings.wallpaperIndex = 0;
    saveSystemSettings();
    applySystemSettings();
  };

  // 5. Кнопка "Пропустить" для загрузки
  const skipBtn = document.getElementById('skip-boot-btn');
  if (skipBtn) skipBtn.onclick = handleSkipBoot;

  // Инициализация функционала часов и перетаскивания окон
  updateClock();
  setInterval(updateClock, 1000);

  const windowsList = document.querySelectorAll('.window');
  windowsList.forEach(win => {
    makeDraggable(win);
    win.addEventListener('mousedown', () => focusWindow(win.id));
  });

  // Запуск первой отрисовки таскбара
  renderTaskbar();

  // Логика меню Пуск
  setupStartMenu();

  // Инициализация «Гостевухи»
  initGuestbook();

  // Динамически загружаем Supabase client library, если прописаны URL и KEY
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Клиент Supabase успешно подключен.");
      } catch (e) {
        console.error("Ошибка инициализации Supabase:", e);
      }
    };
    document.head.appendChild(script);
  } else {
    console.warn("Параметры Supabase не настроены. Гостевая книга запущена в автономном режиме LocalStorage.");
  }
});

// ================= СИСТЕМНЫЕ ЧАСЫ =================

function updateClock() {
  const clockEl = document.getElementById('system-clock');
  if (!clockEl) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  clockEl.textContent = `${hours}:${minutes}`;
}

// ================= ЛОГИКА ГОСТЕВОЙ КНИГИ =================
let guestbookCurrentView = 'write'; // 'write' или 'read'

function initGuestbook() {
  const toggleBtn = document.getElementById('guestbook-btn-toggle-view');
  const importBtn = document.getElementById('guestbook-btn-import');
  const randomBtn = document.getElementById('guestbook-btn-random');
  const agreeCheck = document.getElementById('guestbook-agree-checkbox');
  const submitBtn = document.getElementById('guestbook-btn-submit');
  const nameInput = document.getElementById('guestbook-name-input');
  const msgInput = document.getElementById('guestbook-msg-input');
  const refreshBtn = document.getElementById('guestbook-btn-refresh');

  // Переключение вкладок
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      toggleGuestbookView();
    };
  }

  // Обновить список сообщений
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      loadGuestbookMessages();
    };
  }

  // Импорт имени
  if (importBtn) {
    importBtn.onclick = () => {
      if (nameInput) {
        nameInput.value = (systemSettings.nickname && systemSettings.nickname.trim() !== "") ? systemSettings.nickname.trim() : "путник";
      }
    };
  }

  // Рандомный ник
  if (randomBtn) {
    randomBtn.onclick = () => {
      if (nameInput) {
        nameInput.value = generateRandomNickname();
      }
    };
  }

  // Управление активностью кнопки отправки
  if (agreeCheck) {
    agreeCheck.onchange = () => {
      if (submitBtn) {
        submitBtn.disabled = !agreeCheck.checked;
      }
    };
  }

  // Отправка сообщения
  if (submitBtn) {
    submitBtn.onclick = () => {
      submitGuestbookMessage();
    };
  }
}

function toggleGuestbookView() {
  const writeView = document.getElementById('guestbook-write-view');
  const readView = document.getElementById('guestbook-read-view');
  const toggleBtn = document.getElementById('guestbook-btn-toggle-view');
  const refreshBtn = document.getElementById('guestbook-btn-refresh');

  if (guestbookCurrentView === 'write') {
    guestbookCurrentView = 'read';
    if (writeView) writeView.style.display = 'none';
    if (readView) readView.style.display = 'block';
    if (toggleBtn) toggleBtn.textContent = 'Написать';
    if (refreshBtn) refreshBtn.style.display = 'inline-block';
    loadGuestbookMessages();
  } else {
    guestbookCurrentView = 'write';
    if (writeView) writeView.style.display = 'block';
    if (readView) readView.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = 'Сообщения пользователей';
    if (refreshBtn) refreshBtn.style.display = 'none';
  }
}

function generateRandomNickname() {
  const prefixes = ["Шиншилла", "Анонимус", "Юзер", "Странник", "Путник", "Хакер", "Ретроман", "Гость", "DanShagFan"];
  const suffixes = ["_99", "_2000", "_xp", "_win", "_x", "_dx", "_core", "_nt", "_os"];
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const randomNumber = Math.floor(Math.random() * 900) + 100;
  return `${randomPrefix}${randomSuffix}${randomNumber}`;
}

async function submitGuestbookMessage() {
  const nameInput = document.getElementById('guestbook-name-input');
  const msgInput = document.getElementById('guestbook-msg-input');
  const agreeCheck = document.getElementById('guestbook-agree-checkbox');
  const submitBtn = document.getElementById('guestbook-btn-submit');

  if (!nameInput || !msgInput) return;

  const name = nameInput.value.trim() || "Аноним";
  const message = msgInput.value.trim();

  if (!message) {
    alert("Пожалуйста, напишите ваше сообщение!");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "ОТПРАВКА...";

  const newEntry = {
    name: name,
    message: message,
    created_at: new Date().toISOString()
  };

  try {
    if (supabaseClient) {
      // Сохраняем в Supabase
      const { error } = await supabaseClient
        .from('guestbook_messages')
        .insert([
          { name: name, message: message }
        ]);

      if (error) throw error;
    } else {
      // Автономный режим LocalStorage
      let localMsgs = [];
      try {
        const stored = localStorage.getItem('danshag_local_guestbook');
        if (stored) localMsgs = JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
      localMsgs.unshift(newEntry);
      localStorage.setItem('danshag_local_guestbook', JSON.stringify(localMsgs));
    }

    // Успех! Очищаем форму и переходим к сообщениям
    msgInput.value = '';
    agreeCheck.checked = false;
    submitBtn.disabled = true;
    submitBtn.textContent = "ОТПРАВИТЬ!";

    // Переключаемся на список сообщений
    toggleGuestbookView();

  } catch (err) {
    console.error("Ошибка при отправке сообщения:", err);
    alert("Произошла ошибка при отправке сообщения. Подробности в консоли.");
    submitBtn.disabled = false;
    submitBtn.textContent = "ОТПРАВИТЬ!";
  }
}

async function loadGuestbookMessages() {
  const loader = document.getElementById('guestbook-loader');
  const list = document.getElementById('guestbook-messages-list');

  if (loader) loader.style.display = 'block';
  if (list) list.style.display = 'none';

  let messages = [];

  try {
    if (supabaseClient) {
      // Запрашиваем из Supabase
      const { data, error } = await supabaseClient
        .from('guestbook_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      messages = data || [];
    } else {
      // Автономный режим LocalStorage
      try {
        const stored = localStorage.getItem('danshag_local_guestbook');
        if (stored) messages = JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }
  } catch (err) {
    console.error("Ошибка получения сообщений:", err);
    // Делаем фолбэк на локальные сообщения при сетевой ошибке
    try {
      const stored = localStorage.getItem('danshag_local_guestbook');
      if (stored) messages = JSON.parse(stored);
    } catch (e) { }
  }

  // Отрисовка
  if (list) {
    list.innerHTML = '';
    if (messages.length === 0) {
      list.innerHTML = '<div style="text-align: center; color: #555; font-size: 10px; margin-top: 20px; font-family: \'8bitoperator\', monospace;">Дневник пуст. Напишите первую запись!</div>';
    } else {
      messages.forEach(item => {
        const entry = document.createElement('div');
        entry.className = 'guestbook-entry';

        // Форматирование даты
        let dateStr = 'Давно';
        if (item.created_at) {
          const d = new Date(item.created_at);
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const time = d.toTimeString().split(' ')[0].substring(0, 5);
          dateStr = `${day}.${month}.${year} ${time}`;
        }

        entry.innerHTML = `
          <div class="guestbook-entry-header">
            <span class="guestbook-entry-author">${escapeHtml(item.name)}</span>
            <span class="guestbook-entry-time">${dateStr}</span>
          </div>
          <div class="guestbook-entry-msg">${escapeHtml(item.message)}</div>
        `;
        list.appendChild(entry);
      });
    }

    if (loader) loader.style.display = 'none';
    list.style.display = 'flex';
  }
}

// Простая функция санитации HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ================= ГЛОБАЛЬНЫЙ ГЛИТЧ (КАЖДЫЕ 10 СЕКУНД) =================

setInterval(() => {
  // ПРОПИСАТЬ ЭТУ СТРОКУ:
  if (systemSettings.disableGlitch) return;

  document.body.classList.add('glitch-active');

  // Убираем глитч через 300мс
  setTimeout(() => {
    document.body.classList.remove('glitch-active');
  }, 300);
}, 10000);

// ================= УПРАВЛЕНИЕ ОКНАМИ =================

let windowZIndex = 100;
const openWindowsState = {
  'win-whoami': { open: true, minimized: false, title: 'Кто ты?', icon: 'ds-logo' },
  'win-projects': { open: false, minimized: false, title: 'Проекты', icon: 'floppy' },
  'win-config': { open: false, minimized: false, title: 'Девайсы/Конфиг', icon: 'pc' },
  'win-player': { open: false, minimized: false, title: 'Плеер', icon: 'player' },
  'win-cmd': { open: false, minimized: false, title: 'CMD', icon: 'cmd' },
  'win-notepad': { open: false, minimized: false, title: 'Блокнот', icon: 'notepad' },
  'win-settings': { open: false, minimized: false, title: 'Панель управления', icon: 'settings' }
};

function focusWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;

  // Убираем фокус со всех окон
  document.querySelectorAll('.window').forEach(w => {
    w.classList.remove('window-active');
  });

  // Добавляем фокус нужному окну
  win.classList.add('window-active');
  windowZIndex++;
  win.style.zIndex = windowZIndex;

  // Обновляем состояние
  if (openWindowsState[id]) {
    openWindowsState[id].minimized = false;
  }

  renderTaskbar();
}

function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;

  win.style.display = 'flex';
  openWindowsState[id].open = true;
  openWindowsState[id].minimized = false;

  focusWindow(id);
}

function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;

  win.style.display = 'none';
  openWindowsState[id].open = false;
  openWindowsState[id].minimized = false;

  renderTaskbar();
}

function minimizeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;

  win.style.display = 'none';
  openWindowsState[id].minimized = true;

  // Снимаем фокус
  win.classList.remove('window-active');

  // Находим следующее активное окно
  const activeWindows = Object.keys(openWindowsState).filter(
    winId => openWindowsState[winId].open && !openWindowsState[winId].minimized
  );

  if (activeWindows.length > 0) {
    // Фокусируемся на последнем открытом окне
    focusWindow(activeWindows[activeWindows.length - 1]);
  } else {
    renderTaskbar();
  }
}

function toggleWindowFromTaskbar(id) {
  const state = openWindowsState[id];
  if (!state) return;

  if (state.minimized) {
    // Если свернуто — разворачиваем и делаем активным
    openWindow(id);
  } else {
    // Если открыто
    const win = document.getElementById(id);
    if (win && win.classList.contains('window-active')) {
      // И в фокусе — сворачиваем
      minimizeWindow(id);
    } else {
      // Открыто, но не в фокусе — выводим на передний план
      focusWindow(id);
    }
  }
}

// ================= ОТРИСОВКА В КЛАДОК В ТАСКБАРЕ =================

function renderTaskbar() {
  const container = document.getElementById('taskbar-items-container');
  if (!container) return;

  container.innerHTML = '';

  Object.keys(openWindowsState).forEach(id => {
    const state = openWindowsState[id];
    if (state.open) {
      const btn = document.createElement('button');
      btn.className = 'taskbar-btn';

      const winEl = document.getElementById(id);
      const isActive = winEl && winEl.classList.contains('window-active') && !state.minimized;
      if (isActive) {
        btn.classList.add('active');
      }

      // Выбор пиксельной иконки для панели задач
      let iconSvg = '';
      if (state.icon === 'ds-logo') {
        iconSvg = `<svg class="pixel-icon ds-icon-glowing" viewBox="0 0 16 16" width="12" height="12"><path d="M1,2 H7 V4 H9 V2 H15 V8 H13 V10 H15 V14 H9 V12 H7 V14 H1 V8 H3 V6 H1 Z" fill="none" stroke="#00ff00" stroke-width="1.2" /><path d="M4,4 H6 V12 H4 Z M10,4 H12 V6 H10 Z M10,8 H12 V12 H10 Z" fill="#00ff00" /></svg>`;
      } else if (state.icon === 'floppy') {
        iconSvg = `<svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12"><rect x="2" y="2" width="12" height="12" fill="#000"/><rect x="4" y="2" width="6" height="4" fill="#808080"/><rect x="4" y="8" width="8" height="5" fill="#808080"/></svg>`;
      } else if (state.icon === 'pc') {
        iconSvg = `<svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12"><rect x="1" y="1" width="12" height="9" fill="#000"/><rect x="6" y="10" width="2" height="2" fill="#000"/><rect x="4" y="12" width="6" height="1" fill="#000"/></svg>`;
      } else if (state.icon === 'player') {
        iconSvg = `<svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="2" width="10" height="2" fill="#d4af37" /><rect x="2" y="4" width="2" height="8" fill="#d4af37" /><rect x="12" y="4" width="2" height="8" fill="#d4af37" /></svg>`;
      } else if (state.icon === 'cmd') {
        iconSvg = `<svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12"><rect x="1" y="1" width="14" height="14" fill="#000"/><path d="M4,4 L7,6 L4,8" stroke="#00ff00" stroke-width="1" fill="none" /></svg>`;
      } else if (state.icon === 'notepad') {
        iconSvg = `<svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12"><rect x="2" y="1" width="11" height="14" fill="#fff" stroke="#000" /></svg>`;
      } else if (state.icon === 'settings') {
        iconSvg = `<svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12"><rect x="4" y="4" width="8" height="8" fill="#fff" /></svg>`;
      }

      btn.innerHTML = `${iconSvg}<span>${state.title}</span>`;
      btn.onclick = () => toggleWindowFromTaskbar(id);
      container.appendChild(btn);
    }
  });
}

// ================= DRAG AND DROP (ПЕРЕТАСКИВАНИЕ ОКОН) =================

function makeDraggable(windowEl) {
  const header = windowEl.querySelector('.window-header');
  if (!header) return;

  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  header.onmousedown = dragMouseDown;
  header.ontouchstart = dragTouchStart;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // Получаем координаты курсора при старте
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
    focusWindow(windowEl.id);
  }

  function dragTouchStart(e) {
    if (e.touches.length === 1) {
      pos3 = e.touches[0].clientX;
      pos4 = e.touches[0].clientY;
      document.ontouchend = closeDragElement;
      document.ontouchmove = elementTouchDrag;
      focusWindow(windowEl.id);
    }
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // Вычисляем смещение
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    updatePosition();
  }

  function elementTouchDrag(e) {
    if (e.touches.length === 1) {
      pos1 = pos3 - e.touches[0].clientX;
      pos2 = pos4 - e.touches[0].clientY;
      pos3 = e.touches[0].clientX;
      pos4 = e.touches[0].clientY;

      updatePosition();
    }
  }

  function updatePosition() {
    const desktop = document.getElementById('desktop-container');
    const maxLeft = desktop.clientWidth - windowEl.clientWidth;
    const maxTop = desktop.clientHeight - windowEl.clientHeight - 28; // 28px — высота таскбара

    let newTop = windowEl.offsetTop - pos2;
    let newLeft = windowEl.offsetLeft - pos1;

    // Ограничение границами экрана
    if (newTop < 0) newTop = 0;
    if (newTop > maxTop) newTop = maxTop;
    if (newLeft < 0) newLeft = 0;
    if (newLeft > maxLeft) newLeft = maxLeft;

    windowEl.style.top = `${newTop}px`;
    windowEl.style.left = `${newLeft}px`;
  }

  function closeDragElement() {
    // Прекращаем перетаскивание при отпускании кнопки
    document.onmouseup = null;
    document.onmousemove = null;
    document.ontouchend = null;
    document.ontouchmove = null;
  }
}

// ================= ДОПОЛНИТЕЛЬНО: МЕНЮ ПУСК =================

function setupStartMenu() {
  const startBtn = document.getElementById('start-btn');
  const desktop = document.getElementById('desktop-container');

  // Создаем элемент меню пуск динамически
  const startMenu = document.createElement('div');
  startMenu.className = 'window';
  startMenu.id = 'start-menu';
  startMenu.style.cssText = `
    display: none;
    position: absolute;
    bottom: 28px;
    left: 2px;
    width: 210px;                  /* Ширина увеличена со 160px из-за подросших шрифтов */
    min-height: auto !important;   /* Убираем "подбородок" принудительным сбросом */
    height: auto !important;       /* Заставляем меню точно обтягивать контент */
    z-index: 9999;
  `;

  startMenu.innerHTML = `
    <div class="window-body" style="padding: 2px; margin: 2px; background-color: #0c0c0c; border: none; overflow: visible;">
      <div style="display: flex;">
        <div style="width: 24px; background: linear-gradient(180deg, #3a3a3a, #0c0c0c); color: #fff; writing-mode: vertical-lr; transform: rotate(180deg); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; padding: 4px 0; border-right: 1px solid #222;">
          DSOS
        </div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; background-color: #1a1a1a;">
          <button class="menu-item-btn" onclick="openWindow('win-whoami')">
            <svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12">
              <rect x="1" y="3" width="2" height="10" fill="#fff" />
              <rect x="3" y="3" width="4" height="2" fill="#fff" />
              <rect x="3" y="11" width="4" height="2" fill="#fff" />
              <rect x="7" y="5" width="2" height="6" fill="#fff" />
              <rect x="10" y="3" width="5" height="2" fill="#fff" />
              <rect x="10" y="5" width="2" height="2" fill="#fff" />
              <rect x="10" y="7" width="5" height="2" fill="#fff" />
              <rect x="13" y="9" width="2" height="2" fill="#fff" />
              <rect x="10" y="11" width="5" height="2" fill="#fff" />
            </svg>
            Кто ты?
          </button>
          
          <button class="menu-item-btn" onclick="openWindow('win-projects')">
            <svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12">
              <rect x="2" y="2" width="12" height="12" fill="#fff" />
              <rect x="4" y="2" width="6" height="4" fill="#808080" />
              <rect x="4" y="8" width="8" height="5" fill="#808080" />
            </svg>
            Проекты
          </button>
          
          <button class="menu-item-btn" onclick="openWindow('win-config')">
            <svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12">
              <rect x="1" y="1" width="12" height="9" fill="#fff" />
              <rect x="3" y="3" width="8" height="5" fill="#000" />
              <rect x="6" y="10" width="2" height="2" fill="#fff" />
              <rect x="4" y="12" width="6" height="1" fill="#fff" />
            </svg>
            Девайсы
          </button>
          
          <button class="menu-item-btn" onclick="openWindow('win-player')">
            <svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12">
              <rect x="3" y="2" width="10" height="2" fill="#00ffcc" />
              <rect x="2" y="4" width="2" height="8" fill="#00ffcc" />
              <rect x="12" y="4" width="2" height="8" fill="#00ffcc" />
            </svg>
            Плеер
          </button>
          
          <button class="menu-item-btn" onclick="openWindow('win-cmd')">
            <svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12">
              <rect x="1" y="1" width="14" height="14" fill="#000000" />
              <rect x="2" y="2" width="12" height="12" fill="#111111" stroke="#00ff00" stroke-width="1" />
              <path d="M4,4 L7,6 L4,8" stroke="#00ff00" stroke-width="1" fill="none" />
            </svg>
            CMD
          </button>
          
          <button class="menu-item-btn" onclick="openWindow('win-notepad')">
            <svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12">
              <rect x="2" y="1" width="11" height="14" fill="#ffffff" />
              <rect x="1" y="2" width="13" height="12" fill="#ffffff" />
              <line x1="4" y1="4" x2="11" y2="4" stroke="#0000ff" stroke-width="1.5" />
              <line x1="4" y1="7" x2="12" y2="7" stroke="#000000" stroke-width="1.5" />
            </svg>
            Блокнот
          </button>
          
          <div style="height: 1px; background-color: #333; border-bottom: 1px solid #555; margin: 4px 2px;"></div>
          <button class="menu-item-btn" id="btn-shutdown">
            <!-- Иконка выключения -->
            <svg class="pixel-icon" viewBox="0 0 16 16" width="12" height="12">
              <circle cx="8" cy="8" r="5" fill="none" stroke="#ff3333" stroke-width="1.5" />
              <line x1="8" y1="3" x2="8" y2="8" stroke="#ff3333" stroke-width="1.5" />
            </svg>
            Выключить ПК
          </button>
        </div>
      </div>
    </div>
  `;

  desktop.appendChild(startMenu);

  // Добавим стили для кнопок меню Пуск в документ
  const style = document.createElement('style');
  style.innerHTML = `
    .menu-item-btn {
      background: none;
      border: none;
      text-align: left;
      font-family: '8bitoperator', monospace;
      font-size: 11px;
      padding: 6px 8px;
      width: 100%;
      outline: none;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .menu-item-btn:hover {
      background: #3a3a3a;
      color: #fff;
    }
  `;
  document.head.appendChild(style);

  // Поведение кнопки Пуск
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (startMenu.style.display === 'none') {
      startMenu.style.display = 'block';
      startBtn.classList.add('active');
    } else {
      startMenu.style.display = 'none';
      startBtn.classList.remove('active');
    }
  });

  // Закрытие меню пуск по клику на рабочий стол
  desktop.addEventListener('click', () => {
    startMenu.style.display = 'none';
    startBtn.classList.remove('active');
  });

  // Логика "Выключения ПК"
  const shutdownBtn = document.getElementById('btn-shutdown');
  shutdownBtn.addEventListener('click', () => {
    startMenu.style.display = 'none';
    startBtn.classList.remove('active');

    // Эффект выключения: гасим экран и выводим ретро сообщение
    const shutdownScreen = document.createElement('div');
    shutdownScreen.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background-color: #000;
      color: #ff0000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 100000;
      font-size: 20px;
      text-align: center;
      font-family: '8bitoperator', monospace;
    `;
    shutdownScreen.innerHTML = `
      <div>SYSTEM SHUTDOWN</div>
      <div style="font-size: 14px; margin-top: 15px; color: #fff;">Теперь питание компьютера можно отключить.</div>
      <button id="btn-reboot" class="btn-retro" style="margin-top: 30px; padding: 6px 12px; font-size: 12px;">Перезагрузка</button>
    `;

    document.body.appendChild(shutdownScreen);

    document.getElementById('btn-reboot').addEventListener('click', () => {
      shutdownScreen.remove();
      // Сбрасываем куки для теста первого визита при перезапуске
      setCookie('danshag_visits', '0', 365);
      window.location.reload();
    });
  });
}

// ================= ЛОГИКА БЛОКНОТА =================

function saveNotepadContent() {
  const text = document.getElementById('notepad-textarea').value;
  setCookie('danshag_notepad', encodeURIComponent(text), 30);
  const status = document.getElementById('notepad-status-msg');
  if (status) {
    status.textContent = "Сохранено!";
    setTimeout(() => { status.textContent = ""; }, 2000);
  }
}

function loadNotepadContent() {
  const textCookie = getCookie('danshag_notepad');
  if (textCookie) {
    const textarea = document.getElementById('notepad-textarea');
    if (textarea) {
      textarea.value = decodeURIComponent(textCookie);
    }
  }
}

// ================= ЛОГИКА РЕТРО-ПЛЕЕРА =================

window.audioPlayerInstance = new Audio();
window.playerPlaylist = [];
window.playerCurrentIndex = 0;

async function initAudioPlayer() {
  const seek = document.getElementById('player-seek');
  const volume = document.getElementById('player-volume');
  const playBtn = document.getElementById('player-play');
  const stopBtn = document.getElementById('player-stop');
  const prevBtn = document.getElementById('player-prev');
  const nextBtn = document.getElementById('player-next');

  // Статический массив треков. Впишите сюда ваши реальные файлы из папки assets/music/
  let tracks = [
    "MyBoy.mp3",
    "02_любимый_трек_2.mp3",
    "03_любимый_трек_3.mp3",
    "04_любимый_трек_4.mp3",
    "05_любимый_трек_5.mp3",
    "06_любимый_трек_6.mp3",
    "07_любимый_трек_7.mp3",
    "08_любимый_трек_8.mp3",
    "09_любимый_трек_9.mp3",
    "10_любимый_трек_10.mp3"
  ];

  window.playerPlaylist = tracks;
  renderPlaylist();

  // Привязка управления
  playBtn.onclick = togglePlay;
  stopBtn.onclick = stopTrack;
  prevBtn.onclick = prevTrack;
  nextBtn.onclick = nextTrack;

  volume.oninput = (e) => {
    window.audioPlayerInstance.volume = e.target.value / 100;
  };
  window.audioPlayerInstance.volume = volume.value / 100;

  seek.oninput = (e) => {
    if (!isNaN(window.audioPlayerInstance.duration)) {
      window.audioPlayerInstance.currentTime = (e.target.value / 100) * window.audioPlayerInstance.duration;
    }
  };

  // Обновление тайм-кодов и бегунка
  window.audioPlayerInstance.ontimeupdate = () => {
    const curTimeSpan = document.getElementById('player-time-current');
    const durTimeSpan = document.getElementById('player-time-duration');
    if (!isNaN(window.audioPlayerInstance.duration)) {
      seek.value = (window.audioPlayerInstance.currentTime / window.audioPlayerInstance.duration) * 100;
      curTimeSpan.textContent = formatTime(window.audioPlayerInstance.currentTime);
      durTimeSpan.textContent = "/ " + formatTime(window.audioPlayerInstance.duration);
    }
  };

  window.audioPlayerInstance.onended = () => {
    nextTrack();
  };
}

function renderPlaylist() {
  const container = document.getElementById('player-playlist');
  if (!container) return;
  container.innerHTML = '';

  window.playerPlaylist.forEach((track, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    if (index === window.playerCurrentIndex && !window.audioPlayerInstance.paused) {
      item.classList.add('playing-active');
    }
    // Вывод названия файла без расширения
    const title = track.replace(/\.[^/.]+$/, "");
    item.textContent = `${index + 1}. ${title}`;
    item.onclick = () => playTrack(index);
    container.appendChild(item);
  });
}

function playTrack(index) {
  if (index < 0 || index >= window.playerPlaylist.length) return;
  window.playerCurrentIndex = index;

  const trackName = window.playerPlaylist[index];
  window.audioPlayerInstance.src = `./assets/music/${trackName}`;
  window.audioPlayerInstance.play().catch(e => console.log("Ошибка воспроизведения:", e));

  document.getElementById('player-track-title').textContent = trackName.replace(/\.[^/.]+$/, "");
  document.getElementById('player-play').textContent = '⏸';

  renderPlaylist();
}

function togglePlay() {
  if (window.playerPlaylist.length === 0) return;
  if (!window.audioPlayerInstance.src) {
    playTrack(window.playerCurrentIndex);
    return;
  }

  if (window.audioPlayerInstance.paused) {
    window.audioPlayerInstance.play();
    document.getElementById('player-play').textContent = '⏸';
  } else {
    window.audioPlayerInstance.pause();
    document.getElementById('player-play').textContent = '▶';
  }
  renderPlaylist();
}

function stopTrack() {
  window.audioPlayerInstance.pause();
  window.audioPlayerInstance.currentTime = 0;
  document.getElementById('player-play').textContent = '▶';
  renderPlaylist();
}

function prevTrack() {
  let index = window.playerCurrentIndex - 1;
  if (index < 0) index = window.playerPlaylist.length - 1;
  playTrack(index);
}

function nextTrack() {
  let index = window.playerCurrentIndex + 1;
  if (index >= window.playerPlaylist.length) index = 0;
  playTrack(index);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ================= ЛОГИКА КОМАНДНОЙ СТРОКИ (CMD) =================

function initCommandLine() {
  const cmdInput = document.getElementById('cmd-input');
  if (cmdInput) {
    cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const value = cmdInput.value.trim();
        cmdInput.value = '';
        executeCommand(value);
      }
    });
  }

  // Слежение за возвращением пользователя на вкладку (команда anvoidy)
  window.addEventListener('focus', () => {
    if (sessionStorage.getItem('anvoidy_opened') === 'true') {
      const output = document.getElementById('cmd-terminal-output');
      if (output) {
        const notification = document.createElement('div');
        notification.style.color = '#ffff00';
        notification.style.margin = '6px 0';
        notification.textContent = 'А кто это у нас тут такой любопытный ~_~';
        output.appendChild(notification);
        output.scrollTop = output.scrollHeight;
      }
      sessionStorage.removeItem('anvoidy_opened');
    }
  });
}

function executeCommand(input) {
  const output = document.getElementById('cmd-terminal-output');
  if (!output) return;

  // Отрисовка строки ввода
  const line = document.createElement('div');
  line.innerHTML = `<span style="color: #fff;">C:\\&gt;</span> ${input}`;
  output.appendChild(line);

  const cmd = input.toLowerCase().trim();
  const res = document.createElement('div');
  res.style.margin = '2px 0 8px 0';

  if (cmd === 'help') {
    res.innerHTML = `
      Доступные команды:<br>
      - <b style="color: #fff;">help</b>: Вывод списка доступных команд.<br>
      - <b style="color: #fff;">about</b>: О системе DanShag OS.<br>
      - <b style="color: #fff;">exit</b>: Закрыть командную строку.<br>
      - <b style="color: #fff;">???</b>: ...<br>
      - <b style="color: #ff0000;">Ходят слухи, что это ещё не все команды, которые доступны здесь...</b>
    `;
  } else if (cmd === 'about') {
    res.innerHTML = `
      DanShag OS [Version 10.07.26]<br>
      Все права спизжены. ©<br>
      Разработка: DanShag.
    `;
  } else if (cmd === 'exit') {
    closeWindow('win-cmd');
    return;
  } else if (cmd === 'anvoidy') {
    res.textContent = 'Открытие вкладки https://anvoidy.xyz...';
    sessionStorage.setItem('anvoidy_opened', 'true');
    window.open('https://anvoidy.xyz', '_blank');
  } else if (cmd === 'del c:' || cmd === 'del c: /s' || cmd === 'del c: /q' || cmd === 'del c: /s /q') {
    executeSystemDestruction(output);
    return;
  } else if (cmd === '') {
    // Пустой ввод
    return;
  } else {
    res.textContent = `"${input}" не является внутренней или внешней командой, исполняемой программой или пакетным файлом.`;
  }

  output.appendChild(res);
  output.scrollTop = output.scrollHeight;
}

function focusCmdInput() {
  const input = document.getElementById('cmd-input');
  if (input) input.focus();
}

// ================= СЦЕНАРИЙ УНИЧТОЖЕНИЯ СИСТЕМЫ (del C:) =================

function executeSystemDestruction(output) {
  const input = document.getElementById('cmd-input');
  if (input) input.disabled = true;

  const logs = [
    "Удаление дескрипторов C:\\Windows...",
    "Очистка C:\\Windows\\System32\\hal.dll... УСПЕШНО",
    "Удаление профиля пользователя C:\\Users\\DanShag...",
    "Удаление структуры тома NTFS...",
    "КРИТИЧЕСКИЙ СБОЙ: СИСТЕМА ПОВРЕЖДЕНА.",
    "Выключение питания ядра..."
  ];

  let delay = 0;
  logs.forEach((log, index) => {
    setTimeout(() => {
      const line = document.createElement('div');
      line.style.color = '#ff3333';
      line.textContent = log;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;

      if (index === logs.length - 1) {
        // Добавляем класс темноты на html и body, чтобы полностью убрать фоновые изображения
        document.documentElement.classList.add('system-dead');
        document.body.classList.add('destruction-glitch', 'system-dead');

        setTimeout(() => {
          // Запись состояния и полный блэкаут
          setCookie('danshag_sys_deleted', 'true', 365);
          localStorage.setItem('danshag_sys_deleted', 'true');

          document.body.innerHTML = `
            <div id="critical-system-overlay" style="background-color: #000000; color: #ff3333;">
              <div style="font-size: 24px; font-weight: bold;">Ну и что ты наделал?</div>
            </div>
          `;
        }, 3000);
      }
    }, delay);
    delay += 500;
  });
}

// ================= ВОССТАНОВЛЕНИЕ СИСТЕМЫ =================

function showRecoveryPrompt() {
  document.body.innerHTML = `
    <div id="critical-system-overlay">
      <div class="critical-prompt-box">
        <div class="critical-title">А что случилось? Стыдно стало? Будем восстанавливать?</div>
        <div class="critical-btns">
          <button class="btn-retro" onclick="runSystemRecovery()">Да</button>
          <button class="btn-retro btn-stfu" onclick="runStfuOption()">STFU</button>
        </div>
      </div>
    </div>
  `;
}

function runSystemRecovery() {
  const box = document.querySelector('.critical-prompt-box');
  if (!box) return;

  box.innerHTML = `
    <div class="critical-title" style="color: #00ff00;">C:\\Windows\\System32\\recovery.exe</div>
    <div id="recovery-log" style="text-align: left; font-family: monospace; font-size: 10px; color: #00ff00; height: 160px; overflow-y: auto; background: #050505; border: 1.5px inset #222; padding: 6px;">
      <div>[PROCESS] Запуск утилит дефрагментации и восстановления...</div>
    </div>
  `;

  const logs = [
    "[INFO] Сканирование поврежденных секторов диска...",
    "[INFO] Проверка структуры NTFS: Ошибок нет.",
    "[WARNING] Обнаружено отсутствие 1587 файлов системных ядер.",
    "[PROCESS] Восстановление файлов ядра Windows 2000...",
    "[PROCESS] Копирование ядра ntoskrnl.exe...",
    "[PROCESS] Копирование библиотек hal.dll...",
    "[PROCESS] Проверка структуры профиля DanShag...",
    "[INFO] Профиль восстановлен.",
    "[SUCCESS] Проверка файлов целостности: 100%.",
    "[INFO] Перезагрузка системы через 2 секунды..."
  ];

  let index = 0;
  const logEl = document.getElementById('recovery-log');
  const interval = setInterval(() => {
    if (index < logs.length) {
      const line = document.createElement('div');
      line.textContent = logs[index];
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
      index++;
    } else {
      clearInterval(interval);
      // Очистка cookies и localStorage
      setCookie('danshag_sys_deleted', 'false', -1);
      localStorage.removeItem('danshag_sys_deleted');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }, 450);
}

function runStfuOption() {
  document.body.innerHTML = `
    <div id="critical-system-overlay" style="background-color: #000000;">
      <div class="critical-fadeout-text" id="stfu-fade-text">Это твой личный выбор.</div>
    </div>
  `;

  setTimeout(() => {
    const text = document.getElementById('stfu-fade-text');
    if (text) {
      text.style.opacity = '0';
    }
  }, 500);
}


