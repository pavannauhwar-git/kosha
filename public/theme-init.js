// Applies the saved theme before first paint. Loaded as a blocking classic
// script from index.html so the CSP can forbid inline scripts.
// The colours must match --ds-surface in src/index.css; once the app loads,
// main.jsx keeps theme-color in sync from that variable.
(function () {
  try {
    var stored = localStorage.getItem('kosha-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (!stored && prefersDark);
    if (isDark) document.documentElement.classList.add('dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#1E1F20' : '#FFFFFF');
  } catch (e) { }
})();
