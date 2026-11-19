// Applies the saved theme before first paint. Loaded as a blocking classic
// script from index.html so the CSP can forbid inline scripts.
// The colours must match --ds-surface-dim in src/index.css (the page and the
// loader); once the app loads, src/lib/themeColor.js keeps theme-color in sync.
(function () {
  try {
    var stored = localStorage.getItem('kosha-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (!stored && prefersDark);
    if (isDark) document.documentElement.classList.add('dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0F0F11' : '#F0F4F9');
  } catch (e) { }
})();
