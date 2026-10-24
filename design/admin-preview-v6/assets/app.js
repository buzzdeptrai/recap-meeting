/**
 * Biên bản (Recap Meeting) — Design System v6 Interactive Script
 * Handles Theme Toggling, Tab Filtering, Live Search, Drawer Previews & Audio Controls.
 */

(function () {
  'use strict';

  // --- 1. Theme Management (Light / Dark) ---
  const THEME_KEY = 'recap_v6_theme';

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(savedTheme);

    document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      });
    });
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_KEY, theme);

    // Update icon if present
    document.querySelectorAll('[data-theme-icon]').forEach((icon) => {
      icon.innerHTML = theme === 'dark'
        ? '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    });
  }

  // --- 2. Keyboard Shortcuts (Cmd+K / Ctrl+K) ---
  function initShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.global-search-input') || document.querySelector('[data-search-target]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });
  }

  // --- 3. Interactive Filter Tabs (All / Live / Ended / Draft) ---
  function initFilterTabs() {
    const tabs = document.querySelectorAll('[data-filter-tab]');
    const rows = document.querySelectorAll('[data-meeting-status]');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        const filter = tab.getAttribute('data-filter-tab');
        rows.forEach((row) => {
          const status = row.getAttribute('data-meeting-status');
          if (filter === 'all' || status === filter) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });
  }

  // --- 4. Instant Table Search ---
  function initTableSearch() {
    const searchInputs = document.querySelectorAll('[data-table-search]');
    searchInputs.forEach((input) => {
      input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const targetTable = document.querySelector(input.getAttribute('data-table-search'));
        if (!targetTable) return;

        const rows = targetTable.querySelectorAll('tbody tr');
        rows.forEach((row) => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? '' : 'none';
        });
      });
    });
  }

  // --- 5. Interactive Checklist Toggle ---
  function initChecklist() {
    document.querySelectorAll('.action-checkbox').forEach((box) => {
      box.addEventListener('click', () => {
        box.classList.toggle('checked');
        const isChecked = box.classList.contains('checked');
        box.innerHTML = isChecked
          ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
          : '';

        const row = box.closest('.action-item-row');
        if (row) {
          const title = row.querySelector('.action-title');
          if (title) {
            title.style.textDecoration = isChecked ? 'line-through' : 'none';
            title.style.opacity = isChecked ? '0.6' : '1';
          }
        }
      });
    });
  }

  // --- 6. Minutes Language Switcher (VI / EN / Song ngữ) ---
  function initMinutesLanguage() {
    const langBtns = document.querySelectorAll('[data-minutes-lang]');
    langBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        langBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const lang = btn.getAttribute('data-minutes-lang');
        document.querySelectorAll('[data-lang-content]').forEach((el) => {
          const elLang = el.getAttribute('data-lang-content');
          if (lang === 'both') {
            el.style.display = '';
          } else if (elLang === lang) {
            el.style.display = '';
          } else {
            el.style.display = 'none';
          }
        });
      });
    });
  }

  // --- 7. Drawer Preview Simulation ---
  function initDrawer() {
    const drawerBackdrop = document.getElementById('meetingDrawer');
    if (!drawerBackdrop) return;

    document.querySelectorAll('[data-action="open-drawer"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        drawerBackdrop.classList.add('open');
      });
    });

    const closeBtn = drawerBackdrop.querySelector('[data-action="close-drawer"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => drawerBackdrop.classList.remove('open'));
    }

    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) {
        drawerBackdrop.classList.remove('open');
      }
    });
  }

  // --- 8. Audio Player Simulation in Minutes ---
  function initAudioPlayer() {
    const playBtn = document.querySelector('[data-action="toggle-audio"]');
    if (!playBtn) return;

    let isPlaying = false;
    let timer = null;
    let currentSeconds = 1104; // 18:24
    const timeDisplay = document.querySelector('[data-audio-time]');
    const waveBars = document.querySelectorAll('.live-wave-bar .wave-bar');

    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playBtn.innerHTML = isPlaying
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>';

      waveBars.forEach((bar) => {
        bar.style.animationPlayState = isPlaying ? 'running' : 'paused';
      });

      if (isPlaying) {
        timer = setInterval(() => {
          currentSeconds++;
          const mins = String(Math.floor(currentSeconds / 60)).padStart(2, '0');
          const secs = String(currentSeconds % 60).padStart(2, '0');
          if (timeDisplay) timeDisplay.textContent = `${mins}:${secs}`;
        }, 1000);
      } else {
        clearInterval(timer);
      }
    });
  }

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initShortcuts();
    initFilterTabs();
    initTableSearch();
    initChecklist();
    initMinutesLanguage();
    initDrawer();
    initAudioPlayer();
  });
})();
