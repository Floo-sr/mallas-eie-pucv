document.addEventListener('DOMContentLoaded', () => {
    const mallaContainer = document.getElementById('malla-container');
    const clearCompletedBtn = document.getElementById('clearCompleted'); // Asegúrate de que este botón exista en tu HTML

    let ramosData = [];
    // Carga los ramos completados desde el almacenamiento local, o un Set vacío si no hay nada
    let completedRamos = new Set(JSON.parse(localStorage.getItem('completedRamos')) || []);

    // Agrega el evento para el botón de limpiar ramos completados
    if (clearCompletedBtn) { // Asegúrate de que el botón exista antes de añadir el listener
        clearCompletedBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres limpiar todos los ramos aprobados? Esta acción no se puede deshacer.')) {
                completedRamos.clear(); // Limpia el Set de ramos completados
                localStorage.removeItem('completedRamos'); // Elimina el item del almacenamiento local
                renderMalla(); // Vuelve a renderizar la malla para actualizar el estado visual
                alert('Todos los ramos aprobados han sido limpiados.');
            }
        });
    }

    // Cargar el archivo ramos.json
    fetch('ramos.json')
        .then(response => {
            if (!response.ok) {
                // Si la respuesta no es OK (ej. 404 Not Found), lanza un error
                throw new Error(`Error al cargar ramos.json: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            ramosData = data;
            renderMalla(); // Una vez que los datos estén cargados, renderiza la malla
        })
        .catch(error => console.error('Error al cargar los ramos:', error));

    // Función principal para renderizar la malla curricular
    function renderMalla() {
        mallaContainer.innerHTML = ''; // Limpia el contenido actual antes de renderizar

        const ramosPorAnioYSemestre = {};
        let maxSemestre = 0; // Para encontrar el semestre más alto con ramos

        // Organizar los ramos por año y semestre y encontrar el semestre máximo
        ramosData.forEach(ramo => {
            if (ramo.semestre) { // Asegúrate de que el semestre exista y sea un número
                const anio = Math.ceil(ramo.semestre / 2);
                if (!ramosPorAnioYSemestre[anio]) {
                    ramosPorAnioYSemestre[anio] = {};
                }
                if (!ramosPorAnioYSemestre[anio][ramo.semestre]) {
                    ramosPorAnioYSemestre[anio][ramo.semestre] = [];
                }
                ramosPorAnioYSemestre[anio][ramo.semestre].push(ramo);

                // Actualizar el semestre máximo encontrado
                if (ramo.semestre > maxSemestre) {
                    maxSemestre = ramo.semestre;
                }
            } else {
                console.warn('Ramo sin número de semestre definido:', ramo);
            }
        });

        // Si no hay ramos, o el semestre máximo es 0, no renderizamos nada o mostramos un mensaje
        if (maxSemestre === 0) {
            mallaContainer.innerHTML = '<p>No se encontraron ramos para mostrar. Por favor, verifica tu archivo ramos.json.</p>';
            return;
        }

        // Calcular el último año basado en el semestre máximo real
        const ultimoAnio = Math.ceil(maxSemestre / 2);

        // Iterar para crear cada año
        for (let anio = 1; anio <= ultimoAnio; anio++) {
            const anioSection = document.createElement('section');
            anioSection.classList.add('anio-section');
            anioSection.innerHTML = `<h2>Año ${anio}</h2>`;

            const semestresContainer = document.createElement('div');
            semestresContainer.classList.add('semestres-container');

            const primerSemestreAnio = (anio - 1) * 2 + 1;
            const segundoSemestreAnio = primerSemestreAnio + 1;

            // Iterar sobre los dos semestres que corresponden al año
            [primerSemestreAnio, segundoSemestreAnio].forEach(semestreNumero => {
                // Solo renderizar semestres que son iguales o menores al maxSemestre real
                // O si es el segundo semestre del último año, para mantener la estructura visual
                if (semestreNumero <= maxSemestre || (anio === ultimoAnio && semestreNumero === segundoSemestreAnio)) {
                    const semestreDiv = document.createElement('div');
                    semestreDiv.classList.add('semestre');
                    semestreDiv.setAttribute('data-semestre', semestreNumero);
                    semestreDiv.innerHTML = `<h3>Semestre ${semestreNumero}</h3>`;

                    const ramosList = document.createElement('div');
                    ramosList.classList.add('ramos-list');

                    const ramosEnSemestre = ramosPorAnioYSemestre[anio] && ramosPorAnioYSemestre[anio][semestreNumero] ? ramosPorAnioYSemestre[anio][semestreNumero] : [];
                    // Ordenar los ramos alfabéticamente por nombre
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

        updateRamoStates(); // Actualiza los estados de completado y desbloqueado
    }

    // Crea el elemento DIV para cada ramo
    function createRamoElement(ramo) {
        const ramoDiv = document.createElement('div');
        ramoDiv.classList.add('ramo');

        // Normalizar el tipo de ramo para usarlo como clase CSS
        // Eliminar espacios, reemplazar tildes, reemplazar ñ
        if (ramo.tipo) {
            const tipoClass = ramo.tipo
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Eliminar tildes
                .replace(/\s/g, '') // Eliminar espacios
                .replace(/ñ/g, 'n') // Reemplazar ñ
                .toLowerCase(); // Convertir a minúsculas para consistencia con CSS

            ramoDiv.classList.add(tipoClass);
        } else {
            ramoDiv.classList.add('tipodesconocido'); // Clase por defecto si el tipo no está definido
        }


        ramoDiv.setAttribute('data-codigo', ramo.codigo || '');
        ramoDiv.setAttribute('data-semestre', ramo.semestre || '');
        // Guardar prerrequisitos como una cadena JSON para fácil acceso
        ramoDiv.setAttribute('data-prerrequisitos', JSON.stringify(ramo.prerrequisitos || []));

        // Usar || '' para asegurar que no aparezca "undefined" si el campo está vacío o no existe
        ramoDiv.innerHTML = `
            <div class="codigo">${ramo.codigo || 'N/A'}</div>
            <div class="nombre">${ramo.ramo || 'Ramo Desconocido'}</div>
            <div class="creditos">${ramo.creditos || '0'} Créditos</div>
        `;

        // Añadir evento click para marcar/desmarcar ramo
        ramoDiv.addEventListener('click', (event) => {
            // Evitar que el clic en el ramo se propague al contenedor de la malla
            event.stopPropagation();
            toggleRamoCompleted(ramo.codigo);
        });

        // Eventos para resaltar al pasar el ratón
        ramoDiv.addEventListener('mouseover', () => {
            highlightRelatedRamos(ramo.codigo);
        });

        ramoDiv.addEventListener('mouseout', () => {
            clearHighlights();
            // Si hay un ramo actualmente seleccionado, resaltarlo de nuevo
            if (currentSelectedRamo) {
                highlightRelatedRamos(currentSelectedRamo);
            }
        });

        return ramoDiv;
    }

    // Alternar el estado de completado de un ramo
    function toggleRamoCompleted(codigo) {
        if (completedRamos.has(codigo)) {
            completedRamos.delete(codigo); // Desmarcar si ya está completado
        } else {
            const ramo = ramosData.find(r => r.codigo === codigo);
            // Verificar prerrequisitos antes de marcar como completado
            if (ramo && !arePrerequisitesMet(ramo.prerrequisitos)) {
                alert('No puedes marcar este ramo como aprobado. Faltan prerrequisitos.');
                return; // No marca el ramo si faltan prerrequisitos
            }
            completedRamos.add(codigo); // Marcar como completado
        }
        // Guardar el estado actualizado en el almacenamiento local
        localStorage.setItem('completedRamos', JSON.stringify(Array.from(completedRamos)));
        updateRamoStates(); // Actualizar la visualización
    }

    // Verificar si los prerrequisitos de un ramo han sido cumplidos
    function arePrerequisitesMet(prerrequisitos) {
        if (!prerrequisitos || prerrequisitos.length === 0) {
            return true; // No hay prerrequisitos, se considera cumplido
        }
        // Todos los prerrequisitos deben estar
