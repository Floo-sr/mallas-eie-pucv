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

        // Calcular el número máximo de semestres
        const maxSemestre = Math.max(...ramosData.map(ramo => ramo.semestre));

        // Crear el contenedor de la cuadrícula principal
        const mallaGrid = document.createElement('div');
        mallaGrid.classList.add('malla-grid-container');

        // Crear encabezados de semestre
        for (let s = 1; s <= maxSemestre; s++) {
            const semesterHeader = document.createElement('div');
            semesterHeader.classList.add('semester-grid-header');
            semesterHeader.textContent = `Semestre ${s}`;
            mallaGrid.appendChild(semesterHeader);
        }

        // Crear los contenedores para cada semestre (columnas)
        const semesterColumns = {};
        for (let s = 1; s <= maxSemestre; s++) {
            const semestreDiv = document.createElement('div');
            semestreDiv.classList.add('semestre-grid-column');
            semestreDiv.setAttribute('data-semestre', s);
            semesterColumns[s] = semestreDiv; // Guardar referencia para añadir ramos
            mallaGrid.appendChild(semestreDiv);
        }

        // Agrupar ramos por semestre
        const ramosPorSemestre = {};
        ramosData.forEach(ramo => {
            if (!ramosPorSemestre[ramo.semestre]) {
                ramosPorSemestre[ramo.semestre] = [];
            }
            ramosPorSemestre[ramo.semestre].push(ramo);
        });

        // Añadir ramos a sus respectivas columnas de semestre
        for (let s = 1; s <= maxSemestre; s++) {
            const ramosEnSemestre = ramosPorSemestre[s] || [];
            ramosEnSemestre.sort((a, b) => a.nombre.localeCompare(b.nombre)); // Opcional: ordenar alfabéticamente

            ramosEnSemestre.forEach(ramo => {
                const ramoDiv = createRamoElement(ramo);
                semesterColumns[s].appendChild(ramoDiv);
            });
        }

        mallaContainer.appendChild(mallaGrid);
        updateRamoStates(); // Actualizar estados iniciales (completados, desbloqueados)
    }


    function createRamoElement(ramo) {
        const ramoDiv = document.createElement('div');
        ramoDiv.classList.add('ramo');
        ramoDiv.classList.add(ramo.tipo.replace(/\s/g, '')); // Añade clase con el tipo (sin espacios)
        ramoDiv.setAttribute('data-codigo', ramo.codigo);
        ramoDiv.setAttribute('data-semestre', ramo.semestre);
        ramoDiv.setAttribute('data-prerrequisitos', JSON.stringify(ramo.prerrequisitos)); // Guardar prerrequisitos

        ramoDiv.innerHTML = `
            <div class="codigo">${ramo.codigo}</div>
            <div class="nombre">${ramo.nombre}</div>
            <div class="creditos">${ramo.creditos} Créditos</div>
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

    let currentSelectedRamo = null; // Para manejar el resaltado persistente al hacer clic

    function highlightRelatedRamos(codigo) {
        if (currentSelectedRamo === codigo) return; // No hacer nada si ya está seleccionado

        clearHighlights(); // Limpiar resaltados anteriores

        const selectedRamoDiv = document.querySelector(`.ramo[data-codigo="${codigo}"]`);
        if (!selectedRamoDiv) return;

        // Resaltar el ramo seleccionado
        selectedRamoDiv.classList.add('highlight-selected');

        const ramo = ramosData.find(r => r.codigo === codigo);

        if (ramo) {
            // Resaltar prerrequisitos
            ramo.prerrequisitos.forEach(prereqCodigo => {
                const prereqDiv = document.querySelector(`.ramo[data-codigo="${prereqCodigo}"]`);
                if (prereqDiv) {
                    prereqDiv.classList.add('highlight-prereq');
                }
            });

            // Resaltar ramos que este ramo desbloquea
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

    // Al hacer clic en un ramo, también podemos hacer que el resaltado sea persistente
    mallaContainer.addEventListener('click', (event) => {
        const clickedRamo = event.target.closest('.ramo');
        if (clickedRamo) {
            const codigo = clickedRamo.dataset.codigo;
            if (currentSelectedRamo === codigo) {
                // Si se hace clic en el mismo ramo, lo deseleccionamos
                currentSelectedRamo = null;
                clearHighlights();
            } else {
                // Si se hace clic en un ramo diferente, lo seleccionamos
                currentSelectedRamo = codigo;
                highlightRelatedRamos(codigo);
            }
        } else {
            // Si se hace clic fuera de un ramo, deseleccionamos todo
            currentSelectedRamo = null;
            clearHighlights();
        }
    });

    // Limpiar resaltados al mover el ratón fuera de un ramo si no hay uno seleccionado clickeado
    mallaContainer.addEventListener('mouseout', (event) => {
        if (currentSelectedRamo === null) {
            clearHighlights();
        }
    });

    // Al pasar el ratón por encima, se muestra el resaltado, pero no se altera el 'currentSelectedRamo'
    mallaContainer.addEventListener('mouseover', (event) => {
        const hoveredRamo = event.target.closest('.ramo');
        if (hoveredRamo && currentSelectedRamo !== hoveredRamo.dataset.codigo) {
            highlightRelatedRamos(hoveredRamo.dataset.codigo);
        } else if (!hoveredRamo && currentSelectedRamo === null) {
             // Si el ratón sale de un ramo y no hay uno clickeado, limpiar
            clearHighlights();
        }
    });

    // Asegurarse de que el último clic permanezca si el ratón sale y vuelve a entrar
    mallaContainer.addEventListener('mouseleave', () => {
        if (currentSelectedRamo !== null) {
            // Si hay un ramo clickeado, solo limpiar los demás resaltados (no el seleccionado)
            // y luego volver a aplicar el del clickeado. Esto evita que se borre si el mouse sale del container.
            clearHighlights(); // Limpiar todo primero
            if(currentSelectedRamo) {
                 highlightRelatedRamos(currentSelectedRamo); // Volver a resaltar el seleccionado
            }
        } else {
            clearHighlights();
        }
    });
});
