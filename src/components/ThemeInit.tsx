// Parent pages have no Settings provider and no stored theme preference, so
// they get the app default: dark. Rendered as an inline script (server
// component, ends up in the static HTML) so the `dark` class lands while the
// document is still parsing — before first paint, no light flash.
export default function ThemeInit() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.classList.add("dark");`,
      }}
    />
  );
}
