// Parent pages have no Settings provider and no stored theme preference, so
// they get the app default: light, including after leaving a dark student page.
export default function ThemeInit() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.classList.remove("dark");document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content="#F7F6F2"});`,
      }}
    />
  );
}
