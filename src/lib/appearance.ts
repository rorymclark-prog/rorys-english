// Only an explicit "light" opts out of the device's own setting, so a student
// whose phone is in dark mode gets the dark app the first time they open it.
export function usesDarkTheme(theme: unknown, systemDark: boolean): boolean {
  return theme === "dark" || (theme !== "light" && systemDark);
}

// Rendered before first paint. A missing or unreadable choice follows the
// device; an explicit Light or Dark choice always wins.
export function themeScript(studentId: string): string {
  const key = JSON.stringify(`${studentId}_settings`).replace(/</g, "\\u003c");
  return (
    `(function(){try{var t=null;try{var r=localStorage.getItem(${key});` +
    `if(r){var s=JSON.parse(r);t=s.theme;var p=s.palette;if(p==="blue"||p==="indigo"||p==="clay")document.documentElement.setAttribute("data-palette",p);var z=s.textScale;` +
    `if(z==="normal"||z==="large"||z==="xl")document.documentElement.setAttribute("data-text-scale",z)}}catch(e){}` +
    `var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);` +
    `document.documentElement.classList.toggle("dark",d);` +
    `document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=d?"#151C2B":"#F7F6F2"})}catch(e){}})()`
  );
}
