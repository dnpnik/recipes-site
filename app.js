/* Пряная кухня — логика каталога рецептов */
(() => {
  'use strict';

  const DATA_URL = 'data/recipes.json';
  const LS_FAV = 'pryanaya-kuhnya:favorites';
  const LS_THEME = 'pryanaya-kuhnya:theme';

  const state = {
    recipes: [],
    query: '',
    category: 'all',
    favoritesOnly: false,
    favorites: new Set(load(LS_FAV, [])),
    activeId: null,
    servings: 0,
  };

  const $ = (sel) => document.querySelector(sel);
  const els = {
    grid: $('#grid'),
    chips: $('#chips'),
    search: $('#search'),
    resetBtn: $('#resetBtn'),
    empty: $('#empty'),
    emptyReset: $('#emptyReset'),
    resultLine: $('#resultLine'),
    favFilter: $('#favFilter'),
    favCount: $('#favCount'),
    themeToggle: $('#themeToggle'),
    themeIcon: $('#themeIcon'),
    dialog: $('#dialog'),
    dialogTitle: $('#dialogTitle'),
    dialogCategory: $('#dialogCategory'),
    dialogMeta: $('#dialogMeta'),
    dialogDesc: $('#dialogDesc'),
    dialogSpices: $('#dialogSpices'),
    dialogIngredients: $('#dialogIngredients'),
    dialogSteps: $('#dialogSteps'),
    dialogTip: $('#dialogTip'),
    dialogTipText: $('#dialogTipText'),
    dialogTile: $('#dialogTile'),
    dialogEmoji: $('#dialogEmoji'),
    dialogFav: $('#dialogFav'),
    dialogClose: $('#dialogClose'),
    dialogDone: $('#dialogDone'),
    servingsOut: $('#servingsOut'),
    minus: $('#minusServings'),
    plus: $('#plusServings'),
  };

  /* ---------- storage ---------- */

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* приватный режим — просто не сохраняем */
    }
  }

  /* ---------- helpers ---------- */

  const normalize = (s) => s.toLowerCase().replace(/ё/g, 'е').trim();

  const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

  const INT_UNITS = new Set(['шт', 'зуб.', 'веточки', 'коробочки', 'головка', 'щепотка']);

  function amountText(amount, unit, factor) {
    if (amount == null) return unit || 'по вкусу';
    const raw = amount * factor;

    if (INT_UNITS.has(unit)) {
      if (unit === 'щепотка') {
        const pins = Math.max(1, Math.round(raw));
        return `${pins} ${plural(pins, 'щепотка', 'щепотки', 'щепоток')}`;
      }
      const rounded = Math.max(0.5, Math.round(raw * 2) / 2);
      return `${nf.format(rounded)} ${unit}`;
    }

    let value;
    if (raw >= 100) value = Math.round(raw);
    else if (raw >= 10) value = Math.round(raw * 10) / 10;
    else value = Math.round(raw * 100) / 100;

    return `${nf.format(value)} ${unit}`;
  }

  function plural(n, one, two, five) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return two;
    return five;
  }

  function minutesText(min) {
    if (min < 60) return `${min} мин`;
    const h = Math.floor(min / 60);
    const rest = min % 60;
    const hours = `${h} ${plural(h, 'час', 'часа', 'часов')}`;
    return rest ? `${hours} ${rest} мин` : hours;
  }

  function recipeHaystack(r) {
    return normalize([
      r.title,
      r.description,
      r.category,
      r.difficulty,
      ...(r.spices || []),
      ...(r.tags || []),
      ...(r.ingredients || []).map((i) => i.name),
    ].join(' '));
  }

  /* ---------- filtering ---------- */

  function visibleRecipes() {
    const q = normalize(state.query);
    return state.recipes.filter((r) => {
      if (state.favoritesOnly && !state.favorites.has(r.id)) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (!q) return true;
      return q.split(/\s+/).every((word) => recipeHaystack(r).includes(word));
    });
  }

  /* ---------- rendering ---------- */

  function renderChips() {
    const counts = new Map();
    for (const r of state.recipes) counts.set(r.category, (counts.get(r.category) || 0) + 1);

    const items = [['all', 'Все рецепты', state.recipes.length]];
    for (const [name, count] of counts) items.push([name, name, count]);

    els.chips.replaceChildren(...items.map(([value, label, count]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.category = value;
      b.setAttribute('aria-pressed', String(state.category === value));
      b.textContent = `${label} · ${count}`;
      return b;
    }));
  }

  function cardEl(recipe) {
    const card = document.createElement('article');
    card.className = 'card';

    const tile = document.createElement('div');
    tile.className = 'card-tile';
    tile.style.setProperty('--hue', String(recipe.hue ?? 30));
    tile.setAttribute('aria-hidden', 'true');
    const emoji = document.createElement('span');
    emoji.textContent = recipe.emoji || '🍽️';
    tile.append(emoji);

    const fav = document.createElement('button');
    fav.type = 'button';
    fav.className = 'fav';
    fav.dataset.fav = recipe.id;
    const isFav = state.favorites.has(recipe.id);
    fav.setAttribute('aria-pressed', String(isFav));
    fav.setAttribute('aria-label', isFav ? `Убрать «${recipe.title}» из избранного` : `Добавить «${recipe.title}» в избранное`);
    fav.textContent = isFav ? '★' : '☆';

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'card-open';
    open.dataset.open = recipe.id;
    open.setAttribute('aria-label', `Открыть рецепт «${recipe.title}»`);

    const body = document.createElement('div');
    body.className = 'card-body';

    const cat = document.createElement('p');
    cat.className = 'card-cat';
    cat.textContent = recipe.category;

    const h3 = document.createElement('h3');
    h3.textContent = recipe.title;

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = recipe.description;

    const spices = document.createElement('div');
    spices.className = 'spice-tags';
    for (const spice of (recipe.spices || []).slice(0, 3)) {
      const tag = document.createElement('span');
      tag.className = 'spice-tag';
      tag.textContent = spice;
      spices.append(tag);
    }

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const timePill = document.createElement('span');
    timePill.className = 'meta-pill';
    timePill.textContent = `⏱ ${minutesText(recipe.time)}`;
    const servPill = document.createElement('span');
    servPill.className = 'meta-pill';
    servPill.textContent = `🍽 ${recipe.servings} ${plural(recipe.servings, 'порция', 'порции', 'порций')}`;
    meta.append(timePill, servPill);

    body.append(cat, h3, desc, spices, meta);
    card.append(tile, fav, open, body);
    return card;
  }

  function renderGrid() {
    const list = visibleRecipes();
    els.grid.replaceChildren(...list.map(cardEl));
    els.empty.hidden = list.length > 0;
    els.grid.hidden = list.length === 0;

    const total = state.recipes.length;
    const parts = [];
    if (state.favoritesOnly) parts.push('в избранном');
    if (state.category !== 'all') parts.push(`категория «${state.category}»`);
    if (state.query.trim()) parts.push(`поиск «${state.query.trim()}»`);

    els.resultLine.textContent = list.length === total && !parts.length
      ? `Все ${total} ${plural(total, 'рецепт', 'рецепта', 'рецептов')}`
      : `Найдено ${list.length} из ${total}${parts.length ? ' · ' + parts.join(' · ') : ''}`;

    els.resetBtn.hidden = !(state.query || state.category !== 'all' || state.favoritesOnly);
  }

  function renderFavCount() {
    const n = state.favorites.size;
    els.favCount.textContent = String(n);
    els.favFilter.setAttribute('aria-pressed', String(state.favoritesOnly));
  }

  /* ---------- dialog ---------- */

  let lastFocus = null;

  function openRecipe(id) {
    const recipe = state.recipes.find((r) => r.id === id);
    if (!recipe) return;

    state.activeId = id;
    state.servings = recipe.servings;

    els.dialogCategory.textContent = recipe.category;
    els.dialogTitle.textContent = recipe.title;
    els.dialogMeta.textContent = [
      minutesText(recipe.time),
      recipe.difficulty,
      `${recipe.servings} ${plural(recipe.servings, 'порция', 'порции', 'порций')}`,
    ].join(' · ');
    els.dialogDesc.textContent = recipe.description;

    els.dialogSpices.replaceChildren(...(recipe.spices || []).map((s) => {
      const tag = document.createElement('span');
      tag.className = 'spice-tag';
      tag.textContent = s;
      return tag;
    }));

    els.dialogTile.style.setProperty('--hue', String(recipe.hue ?? 30));
    els.dialogEmoji.textContent = recipe.emoji || '🍽️';

    els.dialogSteps.replaceChildren(...(recipe.steps || []).map((step) => {
      const li = document.createElement('li');
      li.textContent = step;
      return li;
    }));

    if (recipe.tip) {
      els.dialogTip.hidden = false;
      els.dialogTipText.textContent = recipe.tip;
    } else {
      els.dialogTip.hidden = true;
      els.dialogTipText.textContent = '';
    }

    renderServings();
    syncDialogFav();

    lastFocus = document.activeElement;
    if (!els.dialog.open) els.dialog.showModal();
    els.dialogClose.focus();
    history.replaceState(null, '', `#${recipe.id}`);
  }

  function renderServings() {
    const recipe = state.recipes.find((r) => r.id === state.activeId);
    if (!recipe) return;

    const factor = state.servings / recipe.servings;
    els.servingsOut.textContent = String(state.servings);
    els.minus.disabled = state.servings <= 1;
    els.plus.disabled = state.servings >= 24;

    els.dialogIngredients.replaceChildren(...(recipe.ingredients || []).map((ing) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = ing.name;
      const amount = document.createElement('span');
      amount.className = 'amount';
      amount.textContent = amountText(ing.amount, ing.unit, factor);
      li.append(name, amount);
      return li;
    }));
  }

  function syncDialogFav() {
    const isFav = state.favorites.has(state.activeId);
    els.dialogFav.setAttribute('aria-pressed', String(isFav));
    els.dialogFav.textContent = isFav ? '★ В избранном' : '☆ В избранное';
  }

  function closeDialog() {
    if (els.dialog.open) els.dialog.close();
    state.activeId = null;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  /* ---------- actions ---------- */

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    save(LS_FAV, [...state.favorites]);
    renderFavCount();
    renderGrid();
    if (state.activeId) syncDialogFav();
  }

  function setTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
      save(LS_THEME, theme);
    } else {
      delete document.documentElement.dataset.theme;
      save(LS_THEME, null);
    }
    syncThemeIcon();
  }

  function currentTheme() {
    const explicit = document.documentElement.dataset.theme;
    if (explicit) return explicit;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncThemeIcon() {
    const isDark = currentTheme() === 'dark';
    els.themeIcon.textContent = isDark ? '☀️' : '🌙';
    els.themeToggle.setAttribute('aria-label', isDark ? 'Включить светлую тему' : 'Включить тёмную тему');
    els.themeToggle.title = isDark ? 'Светлая тема' : 'Тёмная тема';
  }

  function resetFilters() {
    state.query = '';
    state.category = 'all';
    state.favoritesOnly = false;
    els.search.value = '';
    renderChips();
    renderFavCount();
    renderGrid();
  }

  /* ---------- events ---------- */

  els.search.addEventListener('input', (e) => {
    state.query = e.target.value;
    renderGrid();
  });

  els.chips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.category = chip.dataset.category;
    renderChips();
    renderGrid();
  });

  els.grid.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      toggleFavorite(fav.dataset.fav);
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) openRecipe(open.dataset.open);
  });

  els.favFilter.addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly;
    renderFavCount();
    renderGrid();
  });

  els.resetBtn.addEventListener('click', resetFilters);
  els.emptyReset.addEventListener('click', resetFilters);

  els.themeToggle.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeIcon);

  els.dialogClose.addEventListener('click', closeDialog);
  els.dialogDone.addEventListener('click', closeDialog);

  els.dialog.addEventListener('click', (e) => {
    if (e.target === els.dialog) closeDialog(); // клик по фону
  });

  els.dialog.addEventListener('close', () => {
    state.activeId = null;
  });

  els.minus.addEventListener('click', () => {
    state.servings = Math.max(1, state.servings - 1);
    renderServings();
  });

  els.plus.addEventListener('click', () => {
    state.servings = Math.min(24, state.servings + 1);
    renderServings();
  });

  els.dialogFav.addEventListener('click', () => {
    if (state.activeId) toggleFavorite(state.activeId);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== els.search) {
      e.preventDefault();
      els.search.focus();
    }
  });

  /* ---------- boot ---------- */

  async function boot() {
    setTheme(load(LS_THEME, null));
    syncThemeIcon();

    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.recipes = Array.isArray(data.recipes) ? data.recipes : [];
    } catch (err) {
      els.grid.hidden = true;
      els.empty.hidden = false;
      els.empty.querySelector('strong').textContent = 'Не удалось загрузить рецепты';
      els.empty.querySelectorAll('p')[2].textContent =
        `Проверьте, что ${DATA_URL} доступен. Если файл открыт напрямую с диска, запустите локальный сервер: python -m http.server`;
      els.resultLine.textContent = String(err && err.message ? err.message : err);
      return;
    }

    renderChips();
    renderFavCount();
    renderGrid();

    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (id && state.recipes.some((r) => r.id === id)) openRecipe(id);

    window.addEventListener('hashchange', () => {
      const next = decodeURIComponent(location.hash.replace(/^#/, ''));
      if (next && state.recipes.some((r) => r.id === next)) openRecipe(next);
    });
  }

  boot();
})();
