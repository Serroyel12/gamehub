async function loadGames() {
    const response = await fetch("data/games.json");
    return await response.json();
}

async function loadTopMonthly() {
    const response = await fetch("data/top_monthly.json");
    return await response.json();
}
