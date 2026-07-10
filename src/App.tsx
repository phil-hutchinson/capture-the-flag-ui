import { APP_NAME, TAGLINE } from "./appInfo.ts";

export function App() {
  return (
    <main className="welcome">
      <h1>{APP_NAME}</h1>
      <p>{TAGLINE}</p>
    </main>
  );
}
