document.addEventListener("DOMContentLoaded", async () => {
  const games = await loadGames();
  const topData = await loadTopMonthly();

  // TOP mensual por IDs
  const topGames = games.filter(game => topData.top.includes(game.id));
  renderGameGrid("top-monthly", topGames);

  // Ranking local (Top 5) — debajo
  // OJO: necesitas un contenedor en index.html con id="local-leaderboard"
  renderLocalLeaderboard("local-leaderboard", games, 5);
});
