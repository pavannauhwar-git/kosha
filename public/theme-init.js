// Applies the saved theme before first paint. Loaded as a blocking classic
// script from index.html so the CSP can forbid inline scripts.
(function () {
  try {
    var stored = localStorage.getItem('kosha-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (!stored && prefersDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#1E1F20');
    } else {
      document.documentElement.classList.add('light');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#FFFFFF');
    }
  } catch (e) { }
})();
