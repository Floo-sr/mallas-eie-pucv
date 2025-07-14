document.addEventListener('DOMContentLoaded', () => {
    const mallaContainer = document.getElementById('malla-container');
    const clearCompletedBtn = document.getElementById('clearCompleted');

    let ramos = []; // Variable para almacenar los datos de los ramos
    let completedRamos = new Set(JSON.parse(localStorage.getItem('completedRamos') || '[]'));

    // Función para cargar los ramos
    function loadRamos() {
        fetch('ramos.json') // Ruta al archivo ramos.json
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                ramos = data; // Asignar los datos cargados a la variable ramos
                renderMalla(); // Una vez cargados los datos, renderizar la malla
            })
            .catch(error => {
                console.error('Error al cargar ramos.json:', error);
                mallaContainer.innerHTML = '<p style="color: red; text-align: center;">Error al cargar la malla curricular. Por favor, asegúrate de que el archivo "ramos.json" esté en la misma carpeta.</p>';
            });
    }

    // Agrupar ramos por año y semestre
    function groupRamosByYearAndSemestre() {
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
        return years;
    }

    // Renderizar la malla
    function renderMalla() {
        mallaContainer.innerHTML = ''; // Limpiar antes de renderizar
        const yearsData = groupRamosByYearAndSemestre();

        Object.keys(yearsData).sort((a, b) => a - b).forEach(yearNum => {
            const yearSection = document.createElement('div');
            yearSection.classList.add('year-section');
            yearSection.innerHTML = `<h3>Año ${yearNum}</h3><div class="semesters-grid"></div>`;
            const semestersGrid = yearSection.querySelector('.semesters-grid');

            Object.keys(yearsData[yearNum]).sort((a, b) => a - b).forEach(semestreNum => {
                const semestreDiv = document.createElement('div');
                semestreDiv.classList.add('semestre');
                semestreDiv.setAttribute('data-semestre', semestreNum);
                semestreDiv.innerHTML = `<h4>Semestre ${semestreNum}</h4>`;

                yearsData[yearNum][semestreNum].forEach(ramo => {
                    const ramoDiv = document.createElement('div');
                    // Asegúrate de que el tipo de ramo se formatee correctamente para la clase CSS
                    const tipoClass = ramo.tipo ? ramo.tipo.replace(/\s/g, '') : 'Default';
                    ramoDiv.classList.add('ramo', tipoClass);
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
                        // No es necesario llamar a updateRamoVisualState y highlightRelatedRamos aquí
                        // renderMalla() ya se encarga de re-renderizar y actualizar los estados
                    });
                    semestreDiv.appendChild(ramoDiv);
                });
                semestersGrid.appendChild(semestreDiv);
            });
            mallaContainer.appendChild(yearSection);
        });
        updateRamoVisualState(); // Actualiza estados iniciales de desbloqueo y el resaltado
    }

    // Toggle completion status
    function toggleRamoCompletion(codigo) {
        // Limpiar resaltados temporales antes de cualquier otra acción
        document.querySelectorAll('.ramo').forEach(r => {
            r.classList.remove('highlight-prereq', 'highlight-unlocks', 'highlight-selected');
        });

        if (completedRamos.has(codigo)) {
            // Si el ramo ya está completado, lo desmarca
            completedRamos.delete(codigo);
        } else {
            // Si el ramo NO está completado, intenta marcarlo
            const ramoToComplete = ramos.find(r => r.codigo === codigo);
            // Verificar si el ramoToComplete existe y tiene prerrequisitos
            const allPrereqsMet = ramoToComplete.prerrequisitos.every(prereq => completedRamos.has(prereq));

            if (allPrereqsMet) {
                completedRamos.add(codigo);
            } else {
                alert(`Para aprobar "${ramoToComplete.nombre}", primero debes aprobar sus prerrequisitos.`);
                // Resaltar los prerrequisitos faltantes si no se puede aprobar
                highlightRelatedRamos(codigo, true); // Pasar true para indicar que solo queremos resaltar prerrequisitos faltantes
                return; // No marca como completado si faltan prerrequisitos
            }
        }
        localStorage.setItem('completedRamos', JSON.stringify(Array.from(completedRamos)));
        renderMalla(); // Re-renderiza para reflejar los cambios y actualizar desbloqueos
        highlightRelatedRamos(codigo); // Resaltar relacionados al final de la operación
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
    // isOnlyPrereqHighlight: si es true, solo resalta los prerrequisitos (usado para cuando no se puede completar un ramo)
    function highlightRelatedRamos(codigoRamoActual, isOnlyPrereqHighlight = false) {
        // Limpia cualquier resaltado previo, excepto 'completed' y 'unlocked'
        document.querySelectorAll('.ramo').forEach(r => {
            // Asegúrate de no quitar .completed o .unlocked
            if (!r.classList.contains('completed') && !r.classList.contains('unlocked')) {
                r.classList.remove('highlight-prereq', 'highlight-unlocks', 'highlight-selected');
            } else {
                r.classList.remove('highlight-prereq', 'highlight-unlocks', 'highlight-selected'); // Igual se quitan los de click
            }
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

        // Resaltar ramos que este ramo desbloquea (solo si no es un highlight de "solo prerrequisitos faltantes")
        if (!isOnlyPrereqHighlight) {
            ramos.forEach(ramo => {
                if (ramo.prerrequisitos.includes(codigoRamoActual)) {
                    const unlocksElement = document.querySelector(`.ramo[data-codigo="${ramo.codigo}"]`);
                    if (unlocksElement && !completedRamos.has(ramo.codigo)) { // Solo resalta si no está completado ya
                        unlocksElement.classList.add('highlight-unlocks');
                    }
                }
            });
        }
    }

    // Limpiar todos los ramos completados
    clearCompletedBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres limpiar todos los ramos aprobados?')) {
            completedRamos.clear();
            localStorage.removeItem('completedRamos');
            renderMalla(); // Re-renderiza para reflejar los cambios
        }
    });

    // Cargar los ramos al inicio
    loadRamos();
});
