document.addEventListener('DOMContentLoaded', () => {
    const mallaContainer = document.getElementById('malla-container');
    const clearCompletedBtn = document.getElementById('clearCompleted');
    let ramosData = [];
    let completedRamos = new Set(JSON.parse(localStorage.getItem('completedRamos')) || []);

    // Función para limpiar todos los ramos completados
    clearCompletedBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres limpiar todos los ramos aprobados?')) {
            completedRamos.clear();
            localStorage.removeItem('completedRamos');
            renderMalla(); // Volver a renderizar la malla para reflejar los cambios
        }
    });

    // Cargar datos de los ramos
    fetch('ramos.json')
        .then(response => response.json())
        .then(data => {
            ramosData = data;
            renderMalla();
        })
        .catch(error => console.error('Error al cargar los ramos:', error));

    function renderMalla() {
        mallaContainer.innerHTML = ''; // Limpiar contenido anterior

        // Agrupar ramos por año y luego por semestre
        const ramosPorAnioYSemestre = {};
        ramosData.forEach(ramo => {
            const anio = Math.ceil(ramo.semestre / 2); // Calcula el año basándose en el semestre
            if (!ramosPorAnioYSemestre[anio]) {
                ramosPorAnioYSemestre[anio] = {};
            }
            if (!ramosPorAnioYSemestre[anio][ramo.semestre]) {
                ramosPorAnioYSemestre[anio][ramo.semestre] = [];
            }
            ramosPorAnioYSemestre[anio][ramo.semestre].push(ramo);
        });

        const aniosOrdenados = Object.keys(ramosPorAnioYSemestre).sort((a, b) => parseInt(a) - parseInt(b));

        aniosOrdenados.forEach(anio => {
            const anioSection = document.createElement('section');
            anioSection.classList.add('anio-section');
            anioSection.innerHTML = `<h2>Año ${anio}</h2>`;

            const semestresContainer = document.createElement('div');
            semestresContainer.classList.add('semestres-container');

            // Determinar los semestres para este año (ej. 1 y 2 para Año 1, 3 y 4 para Año 2)
            const semestresEnAnio = Object.keys(ramosPorAnioYSemestre[anio]).sort((a, b) => parseInt(a) - parseInt(b));

            semestresEnAnio.forEach(semestre => {
                const semestreDiv = document.createElement('div');
                semestreDiv.classList.add('semestre');
                semestreDiv.setAttribute('data-semestre', semestre);
                semestreDiv.innerHTML = `<h3>Semestre ${semestre}</h3>`;

                const ramosList = document.createElement('div');
                ramosList.classList.add('ramos-list');

                const ramosEnSemestre = ramosPorAnioYSemestre[anio][semestre] || [];
                // Opcional: ordenar ramos dentro del semestre si quieres un orden específico, por ejemplo por código o nombre
                ramosEnSemestre.sort((a, b) => a.ramo.localeCompare(b.ramo));

                ramosEnSemestre.forEach(ramo => {
                    const ramoDiv = createRamoElement(ramo);
                    ramosList.appendChild(ramoDiv);
                });

                semestreDiv.appendChild(ramosList);
                semestresContainer.appendChild(semestreDiv);
            });

            anioSection.appendChild(semestresContainer);
            mallaContainer.appendChild(anioSection);
        });

        updateRamoStates(); // Actualizar estados iniciales (completados, desbloqueados)
    }

    function createRamoElement(ramo) {
        const ramoDiv = document.createElement('div');
        ramoDiv.classList.add('ramo');
        // Asegúrate de limpiar el nombre del tipo para usarlo como clase CSS
        ramoDiv.classList.add(ramo.tipo.replace(/\s/g, '').replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u'));
        ramoDiv.setAttribute('data-codigo', ramo.codigo);
        ramoDiv.setAttribute('data-semestre', ramo.semestre);
        ramoDiv.setAttribute('data-prerrequisitos', JSON.stringify(ramo.prerrequisitos)); // Guardar prerrequisitos

        ramoDiv.innerHTML = `
            <div class="codigo">${ramo.codigo || 'N/A'}</div>
            <div class="nombre">${ramo.ramo}</div>
            <div class="creditos">${ramo.creditos || 'N/A'} Créditos</div>
        `;

        // Marcar si está completado
        if (completedRamos.has(ramo.codigo)) {
            ramoDiv.classList.add('completed');
        }

        ramoDiv.addEventListener('click', () => {
            toggleRamoCompleted(ramo.codigo);
        });

        ramoDiv.addEventListener('mouseover', () => {
            highlightRelatedRamos(ramo.codigo);
        });

        ramoDiv.addEventListener('mouseout', () => {
            clearHighlights();
        });

        return ramoDiv;
    }

    function toggleRamoCompleted(codigo) {
        if (completedRamos.has(codigo)) {
            completedRamos.delete(codigo);
        } else {
            // Verificar prerrequisitos antes de marcar como completado
            const ramo = ramosData.find(r => r.codigo === codigo);
            if (ramo && !arePrerequisitesMet(ramo.prerrequisitos)) {
                alert('No puedes marcar este ramo como aprobado, ¡faltan prerrequisitos!');
                return;
            }
            completedRamos.add(codigo);
        }
        localStorage.setItem('completedRamos', JSON.stringify(Array.from(completedRamos)));
        updateRamoStates(); // Actualizar todos los ramos
    }

    function arePrerequisitesMet(prerrequisitos) {
        if (!prerrequisitos || prerrequisitos.length === 0) {
            return true; // No hay prerrequisitos
        }
        // Todos los prerrequisitos deben estar en el conjunto de ramos completados
        return prerrequisitos.every(prereq => completedRamos.has(prereq));
    }

    function updateRamoStates() {
        document.querySelectorAll('.ramo').forEach(ramoDiv => {
            const codigo = ramoDiv.dataset.codigo;
            const ramo = ramosData.find(r => r.codigo === codigo);

            ramoDiv.classList.remove('completed', 'unlocked', 'highlight-prereq', 'highlight-unlocks', 'highlight-selected');

            if (completedRamos.has(codigo)) {
                ramoDiv.classList.add('completed');
            } else if (ramo && arePrerequisitesMet(ramo.prerrequisitos)) {
                ramoDiv.classList.add('unlocked');
            }
        });
    }

    let currentSelectedRamo = null;

    function highlightRelatedRamos(codigo) {
        if (currentSelectedRamo === codigo) return;

        clearHighlights();

        const selectedRamoDiv = document.querySelector(`.ramo[data-codigo="${codigo}"]`);
        if (!selectedRamoDiv) return;

        selectedRamoDiv.classList.add('highlight-selected');

        const ramo = ramosData.find(r => r.codigo === codigo);

        if (ramo) {
            ramo.prerrequisitos.forEach(prereqCodigo => {
                const prereqDiv = document.querySelector(`.ramo[data-codigo="${prereqCodigo}"]`);
                if (prereqDiv) {
                    prereqDiv.classList.add('highlight-prereq');
                }
            });

            ramosData.forEach(otherRamo => {
                if (otherRamo.prerrequisitos.includes(codigo)) {
                    const unlocksDiv = document.querySelector(`.ramo[data-codigo="${otherRamo.codigo}"]`);
                    if (unlocksDiv) {
                        unlocksDiv.classList.add('highlight-unlocks');
                    }
                }
            });
        }
    }

    function clearHighlights() {
        document.querySelectorAll('.ramo').forEach(ramoDiv => {
            ramoDiv.classList.remove('highlight-prereq', 'highlight-unlocks', 'highlight-selected');
        });
    }

    mallaContainer.addEventListener('click', (event) => {
        const clickedRamo = event.target.closest('.ramo');
        if (clickedRamo) {
            const codigo = clickedRamo.dataset.codigo;
            if (currentSelectedRamo === codigo) {
                currentSelectedRamo = null;
                clearHighlights();
            } else {
                currentSelectedRamo = codigo;
                highlightRelatedRamos(codigo);
            }
        } else {
            currentSelectedRamo = null;
            clearHighlights();
        }
    });

    mallaContainer.addEventListener('mouseout', (event) => {
        if (currentSelectedRamo === null) {
            clearHighlights();
        }
    });

    mallaContainer.addEventListener('mouseover', (event) => {
        const hoveredRamo = event.target.closest('.ramo');
        if (hoveredRamo && currentSelectedRamo !== hoveredRamo.dataset.codigo) {
            highlightRelatedRamos(hoveredRamo.dataset.codigo);
        } else if (!hoveredRamo && currentSelectedRamo === null) {
            clearHighlights();
        }
    });

    mallaContainer.addEventListener('mouseleave', () => {
        if (currentSelectedRamo !== null) {
            clearHighlights();
            if(currentSelectedRamo) {
                 highlightRelatedRamos(currentSelectedRamo);
            }
        } else {
            clearHighlights();
        }
    });
});
