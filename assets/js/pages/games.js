document.addEventListener("DOMContentLoaded", async () => {
  const games = await loadGames();

  // Orden: featured primero, luego alfabético
  games.sort((a,b) => {
    const fa = a.featured ? 1 : 0;
    const fb = b.featured ? 1 : 0;
    if (fb !== fa) return fb - fa;
    return (a.title || "").localeCompare(b.title || "");
  });

  const searchEl = document.getElementById("search");
  const noResultsEl = document.getElementById("no-results");

  let activeFilter = "all";

  function apply() {
    const q = (searchEl.value || "").trim().toLowerCase();

    const filtered = games.filter(g => {
      const byFilter = activeFilter === "all" ? true : (g.category === activeFilter);
      const hay = `${g.title || ""} ${g.tagline || ""}`.toLowerCase();
      const bySearch = q === "" ? true : hay.includes(q);
      return byFilter && bySearch;
    });

    renderGameGrid("games-container", filtered);
    noResultsEl.style.display = filtered.length === 0 ? "block" : "none";
  }

  // listeners
  searchEl.addEventListener("input", apply);

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      apply();
    });
  });

  apply();
});
