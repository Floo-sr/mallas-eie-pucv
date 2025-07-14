document.addEventListener('DOMContentLoaded', () => {
    // Los datos de ramos se asumen disponibles globalmente si ramos.json se carga como script.
    // Para una carga más robusta, usar fetch:
    // fetch('ramos.json')
    //   .then(response => response.json())
    //   .then(data => {
    //     initMalla(data);
    //   })
    //   .catch(error => console.error('Error al cargar ramos.json:', error));

    // Usando window.ramosData asumiendo que ramos.json es un JSONP o se inyecta en el global scope
    const ramos = window.ramosData;

    if (!ramos) {
        console.error("No se encontraron los datos de los ramos. Asegúrate de que 'ramos.json' se cargue correctamente.");
        return;
    }

    const mallaContainer = document.getElementById('malla-container');
    const clearCompletedBtn = document.getElementById('clearCompleted');

    // Cargar ramos completados desde localStorage
    let completedRamos = new Set(JSON.parse(localStorage.getItem('completedRamos') || '[]'));

    // Agrupar ramos por año y semestre
    const years = {};
    ramos.forEach(ramo => {
        const year = Math.ceil(ramo.semestre / 2); // 2 semestres por año
        if (!years[year]) {
            years[year] = {};
        }
        if (!years[year][ramo.semestre]) {
            years[year][ramo.semestre] = [];
        }
        years[year][ramo.semestre].push(ramo);
    });

    // Renderizar la malla
    function renderMalla() {
        mallaContainer.innerHTML = ''; // Limpiar antes de renderizar
        Object.keys(years).sort((a, b) => a - b).forEach(yearNum => {
            const yearSection = document.createElement('div');
            yearSection.classList.add('year-section');
            yearSection.innerHTML = `<h3>Año ${yearNum}</h3><div class="semesters-grid"></div>`;
            const semestersGrid = yearSection.querySelector('.semesters-grid');

            Object.keys(years[yearNum]).sort((a, b) => a - b).forEach(semestreNum => {
                const semestreDiv = document.createElement('div');
                semestreDiv.classList.add('semestre');
                semestreDiv.setAttribute('data-semestre', semestreNum);
                semestreDiv.innerHTML = `<h4>Semestre ${semestreNum}</h4>`;

                years[yearNum][semestreNum].forEach(ramo => {
                    const ramoDiv = document.createElement('div');
                    ramoDiv.classList.add('ramo', ramo.tipo.replace(/\s/g, '')); // Añadir clase de tipo (sin espacios)
                    ramoDiv.setAttribute('data-codigo', ramo.codigo);
                    ramoDiv.innerHTML = `
                        <div class="codigo">${ramo.codigo}</div>
                        <div class="nombre">${ramo.nombre}</div>
                        <small>Créditos: ${ramo.creditos}</small>
                    `;

                    // Marcar como completado si ya lo está
                    if (completedRamos.has(ramo.codigo)) {
                        ramoDiv.classList.add('completed');
                    }

                    // Evento click para toggle completado y resaltar
                    ramoDiv.addEventListener('click', () => {
                        toggleRamoCompletion(ramo.codigo);
                        updateRamoVisualState();
                        highlightRelatedRamos(ramo.codigo); // Llama a la función de resaltado
                    });
                    semestreDiv.appendChild(ramoDiv);
                });
                semestersGrid.appendChild(semestreDiv);
            });
            mallaContainer.appendChild(yearSection);
        });
        updateRamoVisualState(); // Actualiza estados iniciales de desbloqueo
    }

    // Toggle completion status
    function toggleRamoCompletion(codigo) {
        if (completedRamos.has(codigo)) {
            completedRamos.delete(codigo);
        } else {
            // Antes de marcar como completado, verificar si sus prerrequisitos están completos
            const ramoToComplete = ramos.find(r => r.codigo === codigo);
            const allPrereqsMet = ramoToComplete.prerrequisitos.every(prereq => completedRamos.has(prereq));

            if (allPrereqsMet) {
                completedRamos.add(codigo);
            } else {
                alert(`Para aprobar "${ramoToComplete.nombre}", primero debes aprobar sus prerrequisitos.`);
                return; // No marca como completado si faltan prerrequisitos
            }
        }
        localStorage.setItem('completedRamos', JSON.stringify(Array.from(completedRamos)));
        renderMalla(); // Re-renderiza para reflejar los cambios y actualizar desbloqueos
    }

    // Actualiza el estado visual de todos los ramos (completed, unlocked)
    function updateRamoVisualState() {
        document.querySelectorAll('.ramo').forEach(ramoDiv => {
            const codigo = ramoDiv.getAttribute('data-codigo');
            const ramo = ramos.find(r => r.codigo === codigo);

            // Limpiar clases de resaltado temporales
            ramoDiv.classList.remove('highlight-prereq', 'highlight-unlocks', 'highlight-selected');

            // Actualizar clase 'completed'
            if (completedRamos.has(codigo)) {
                ramoDiv.classList.add('completed');
            } else {
                ramoDiv.classList.remove('completed');
            }

            // Actualizar clase 'unlocked'
            if (!completedRamos.has(codigo)) { // Solo si el ramo no está ya completado
                const allPrereqsMet = ramo.prerrequisitos.every(prereq => completedRamos.has(prereq));
                if (allPrereqsMet) {
                    ramoDiv.classList.add('unlocked');
                } else {
                    ramoDiv.classList.remove('unlocked');
                }
            } else {
                 ramoDiv.classList.remove('unlocked'); // Un ramo completado no está "desbloqueado"
            }
        });
    }

    // Resalta prerrequisitos y ramos que se desbloquean al hacer clic
    function highlightRelatedRamos(codigoRamoActual) {
        // Limpia cualquier resaltado previo, excepto 'completed' y 'unlocked'
        document.querySelectorAll('.ramo').forEach(r => {
            r.classList.remove('highlight-prereq', 'highlight-unlocks', 'highlight-selected');
        });

        // Resaltar el ramo seleccionado
        const selectedRamoDiv = document.querySelector(`.ramo[data-codigo="${codigoRamoActual}"]`);
        if (selectedRamoDiv) {
            selectedRamoDiv.classList.add('highlight-selected');
        }

        // Resaltar prerrequisitos del ramo actual
        const currentRamo = ramos.find(r => r.codigo === codigoRamoActual);
        if (currentRamo && currentRamo.prerrequisitos) {
            currentRamo.prerrequisitos.forEach(prereqCodigo => {
                const prereqElement = document.querySelector(`.ramo[data-codigo="${prereqCodigo}"]`);
                if (prereqElement) {
                    prereqElement.classList.add('highlight-prereq');
                }
            });
        }

        // Resaltar ramos que este ramo desbloquea
        ramos.forEach(ramo => {
            if (ramo.prerrequisitos.includes(codigoRamoActual)) {
                const unlocksElement = document.querySelector(`.ramo[data-codigo="${ramo.codigo}"]`);
                if (unlocksElement) {
                    unlocksElement.classList.add('highlight-unlocks');
                }
            }
        });
    }

    // Limpiar todos los ramos completados
    clearCompletedBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres limpiar todos los ramos aprobados?')) {
            completedRamos.clear();
            localStorage.removeItem('completedRamos');
            renderMalla();
        }
    });

    // Renderizar la malla al cargar la página
    renderMalla();
});