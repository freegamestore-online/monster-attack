import { GameShell, GameTopbar } from "@freegamestore/games";

export default function App() {
  return (
    <GameShell topbar={<GameTopbar title="monster attack" score={0} />}><div className="flex flex-col items-center justify-center h-full gap-4">
      <h1
        className="text-3xl font-bold mb-4"
        style={{ fontFamily: "Fraunces, serif" }}
      >
        Welcome to monster attack
      </h1>
      <p style={{ color: "var(--muted)" }}>
        Your game will appear here once it&rsquo;s built.
      </p>
    </div></GameShell>
  );
}
