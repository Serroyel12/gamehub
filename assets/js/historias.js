// assets/js/historias.js

// Lista completa de tus dinosaurios basada en tus carpetas
const dinosaurios = [
    { id: "argen", nombre: "Argentavis", historia: "argentavis" },
    { id: "belze", nombre: "Belzebufo", historia: "belzebufo" },
    { id: "dodo", nombre: "Dodo", historia: "dodo" },
    { id: "giga", nombre: "Giganotosaurus", historia: "giga" },
    { id: "grifo", nombre: "Grifo", historia: "grifo" },
    { id: "mana", nombre: "Managarmr", historia: "mana" }, // <-- Nuevo Dino añadido
    { id: "megalodon", nombre: "Megalodon", historia: "megalodon" },
    { id: "mosa", nombre: "Mosasaurio", historia: "mosasaurio" },
    { id: "para", nombre: "Parasaurio", historia: "parasaurio" },
    { id: "raptor", nombre: "Raptor", historia: "raptor" },
    { id: "spino", nombre: "Spinosaurus", historia: "spino" },
    { id: "theri", nombre: "Therizinosaurus", historia: "thericino" },
    { id: "thila", nombre: "Thylacoleo", historia: "thila" },
    { id: "tRex", nombre: "T-Rex", historia: "trex" },
    { id: "wiwern", nombre: "Wyvern", historia: "dragon" }
];

const container = document.getElementById('dino-container');

// Generar los botones automáticamente
if (container) {
    dinosaurios.forEach(dino => {
        const card = document.createElement('div');
        card.className = 'dino-card';
        card.onclick = () => openStory(dino.historia, dino.nombre);
        
        card.innerHTML = `
            <img src="assets/img/botones/${dino.id}.png" alt="${dino.nombre}" onerror="this.src='assets/img/logo_dino.png';">
            <div class="dino-name">${dino.nombre}</div>
        `;
        
        container.appendChild(card);
    });
}

window.openStory = function(historiaKey, titulo) {
    const modal = document.getElementById('story-modal');
    const modalTitle = document.getElementById('modal-title');
    const storyImg = document.getElementById('story-full-img');

    if (modal && modalTitle && storyImg) {
        modalTitle.textContent = titulo;
        storyImg.src = `assets/img/historias/${historiaKey}.png`;
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Evita scroll de fondo
    }
}

window.closeStory = function(event) {
    // Cerrar si hace clic fuera de la imagen o en la X
    const modal = document.getElementById('story-modal');
    if (event.target.id === 'story-modal' || event.target.className === 'close-btn') {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}