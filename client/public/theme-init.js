try {
  var saved = localStorage.getItem("theme");
  var dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  if (dark) document.documentElement.classList.add("dark");
} catch {
  // Storage is blocked: fall back to the light theme.
}
