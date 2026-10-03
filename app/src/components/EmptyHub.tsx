export function EmptyHub() {
  return (
    <main className="empty-hub">
      <h1>No games ready yet</h1>
      <p>Put a game in <code>~/game/ready/&lt;id&gt;/</code> with a <code>game.json</code>, then refresh.
        Run <code>npm run games:check</code> to see which games meet the standard.</p>
    </main>
  );
}
