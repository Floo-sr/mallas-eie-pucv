document.addEventListener('DOMContentLoaded', () => {
    const mallaContainer = document.getElementById('malla-container');
    const clearCompletedBtn = document.getElementById('clearCompleted');

    let ramosData = [];
    let completedRamos = new Set(JSON.parse(localStorage.getItem('completedRamos')) || []);

    // Agrega el evento para el botón de limpiar ramos completados
    if (clearCompletedBtn) {
        clearCompletedBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres limpiar todos los ramos aprobados? Esta acción no se puede deshacer.')) {
                completedRamos.clear();
                localStorage.removeItem('completedRamos');
                renderMalla();
                alert('Todos los ramos aprobados han sido limpiados.');
            }
        });
    }

    // Cargar el archivo ramos.json
    fetch('ramos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar ramos.json: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            ramosData = data;
            renderMalla();
        })
        .catch(error => {
            console.error('Error al cargar los ramos:', error);
            mallaContainer.innerHTML = `<p style="color: red; text-align: center;">Error al cargar la malla: ${error.message}<br>Por favor, verifica el archivo ramos.json y la consola para más detalles.</p>`;
        });

    // Función principal para renderizar la malla curricular
    function renderMalla() {
        mallaContainer.innerHTML = ''; // Limpia el contenido actual

        const ramosPorAnioYSemestre = {};
        let maxSemestre = 0;

        ramosData.forEach(ramo => {
            if (ramo.semestre) {
                const anio = Math.ceil(ramo.semestre / 2);
                if (!ramosPorAnioYSemestre[anio]) {
                    ramosPorAnioYSemestre[anio] = {};
                }
                if (!ramosPorAnioYSemestre[anio][ramo.semestre]) {
                    ramosPorAnioYSemestre[anio][ramo.semestre] = [];
                }
                ramosPorAnioYSemestre[anio][ramo.semestre].push(ramo);

                if (ramo.semestre > maxSemestre) {
                    maxSemestre = ramo.semestre;
                }
            } else {
                console.warn('Ramo sin número de semestre definido o inválido:', ramo);
            }
        });

        if (maxSemestre === 0) {
            mallaContainer.innerHTML = '<p>No se encontraron ramos para mostrar. Por favor, verifica tu archivo ramos.json.</p>';
            return;
        }

        const ultimoAnio = Math.ceil(maxSemestre / 2);

        for (let anio = 1; anio <= ultimoAnio; anio++) {
            const anioSection = document.createElement('section');
            anioSection.classList.add('anio-section');
            anioSection.innerHTML = `<h2>Año ${anio}</h2>`;

            const semestresContainer = document.createElement('div');
            semestresContainer.classList.add('semestres-container');

            const primerSemestreAnio = (anio - 1) * 2 + 1;
            const segundoSemestreAnio = primerSemestreAnio + 1;

            [primerSemestreAnio, segundoSemestreAnio].forEach(semestreNumero => {
                // Solo renderizar semestres que tienen ramos o si son el último semestre del último año
                if (semestreNumero <= maxSemestre || (anio === ultimoAnio && semestreNumero === segundoSemestreAnio)) {
                    const semestreDiv = document.createElement('div');
                    semestreDiv.classList.add('semestre');
                    semestreDiv.setAttribute('data-semestre', semestreNumero);
                    semestreDiv.innerHTML = `<h3>Semestre ${semestreNumero}</h3>`;

                    const ramosList = document.createElement('div');
                    ramosList.classList.add('ramos-list');

                    const ramosEnSemestre = ramosPorAnioYSemestre[anio] && ramosPorAnioYSemestre[anio][semestreNumero] ? ramosPorAnioYSemestre[anio][semestreNumero] : [];
                    ramosEnSemestre.sort((a, b) => (a.ramo || '').localeCompare(b.ramo || ''));

                    ramosEnSemestre.forEach(ramo => {
                        const ramoDiv = createRamoElement(ramo);
                        ramosList.appendChild(ramoDiv);
                    });

                    semestreDiv.appendChild(ramosList);
                    semestresContainer.appendChild(semestreDiv);
                }
            });

            anioSection.appendChild(semestresContainer);
            mallaContainer.appendChild(anioSection);
        }

        updateRamoStates();
    }

    // Crea el elemento DIV para cada ramo
    function createRamoElement(ramo) {
        const ramoDiv = document.createElement('div');
        ramoDiv.classList.add('ramo');

        // Normalizar el tipo de ramo para usarlo como clase CSS (todo en minúsculas, sin tildes/espacios)
        if (ramo.tipo) {
            const tipoClass = ramo.tipo
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Eliminar tildes
                .replace(/\s/g, '') // Eliminar espacios
                .replace(/ñ/g, 'n') // Reemplazar ñ
                .toLowerCase(); // Convertir a minúsculas
            ramoDiv.classList.add(tipoClass);
        } else {
            ramoDiv.classList.add('tipodesconocido'); // Clase por defecto si el tipo no está definido
        }

        ramoDiv.setAttribute('data-codigo', ramo.codigo || '');
        ramoDiv.setAttribute('data-semestre', ramo.semestre || '');
        ramoDiv.setAttribute('data-prerrequisitos', JSON.stringify(ramo.prerrequisitos || []));

        ramoDiv.innerHTML = `
            <div class="codigo">${ramo.codigo || 'N/A'}</div>
            <div class="nombre">${ramo.ramo || 'Ramo Desconocido'}</div>
            <div class="creditos">${ramo.creditos || '0'} Créditos</div>
        `;

        ramoDiv.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleRamoCompleted(ramo.codigo);
        });

        ramoDiv.addEventListener('mouseover', () => {
            highlightRelatedRamos(ramo.codigo);
        });

        ramoDiv.addEventListener('mouseout', () => {
            clearHighlights();
            if (currentSelectedRamo) {
                highlightRelatedRamos(currentSelectedRamo);
            }
        });

        return ramoDiv;
    }

    function toggleRamoCompleted(codigo) {
        if (completedRamos.has(codigo)) {
            completedRamos.delete(codigo);
        } else {
            const ramo = ramosData.find(r => r.codigo === codigo);
            if (ramo && !arePrerequisitesMet(ramo.prerrequisitos)) {
                alert('No puedes marcar este ramo como aprobado. Faltan prerrequisitos.');
                return;
            }
            completedRamos.add(codigo);
        }
        localStorage.setItem('completedRamos', JSON.stringify(Array.from(completedRamos)));
        updateRamoStates();
    }

    function arePrerequisitesMet(prerrequisitos) {
        if (!prerrequisitos || prerrequisitos.length === 0) {
            return true;
        }
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
            (ramo.prerrequisitos || []).forEach(prereqCodigo => {
                const prereqDiv = document.querySelector(`.ramo[data-codigo="${prereqCodigo}"]`);
                if (prereqDiv) {
                    prereqDiv.classList.add('highlight-prereq');
                }
            });

            ramosData.forEach(otherRamo => {
                if (otherRamo.prerrequisitos && otherRamo.prerrequisitos.includes(codigo)) {
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
            highlightRelatedRamos(currentSelectedRamo);
        } else {
            clearHighlights();
        }
    });
});
