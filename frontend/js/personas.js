/**
 * ECOLIFE - Módulo 3: Directorio y Gestión de Personas (CRUD Completo)
 * Conecta con FastAPI endpoints en /personas conectado a Microsoft SQL Server.
 */

import { EcolifeAPI as BaseAPI } from './api.js?v=20261126b';

// Proxy dinámico para asegurar que siempre use la versión más reciente de la API
const EcolifeAPI = new Proxy(BaseAPI, {
  get(target, prop) {
    if (typeof window !== 'undefined' && window.EcolifeAPI && typeof window.EcolifeAPI[prop] === 'function') {
      return window.EcolifeAPI[prop].bind(window.EcolifeAPI);
    }
    return target[prop];
  },
});

let personasList = [];
let editingDni = null;
let deletingDni = null;

/**
 * Inicializa el módulo de personas vinculando eventos y cargando la lista inicial.
 */
export function initPersonasModule() {
  const tableBody = document.getElementById('personas-table-body');
  const searchInput = document.getElementById('personas-search-input');
  const btnSearchDni = document.getElementById('btn-search-dni');
  const btnResetSearch = document.getElementById('btn-reset-personas-search');
  const btnRefresh = document.getElementById('btn-refresh-personas');
  const btnNewPersona = document.getElementById('btn-new-persona');

  // Modal Formulario (Crear / Editar)
  const modalPersona = document.getElementById('modal-persona-form');
  const formPersona = document.getElementById('form-persona');
  const btnCloseModal = document.getElementById('btn-close-persona-modal');
  const btnCancelModal = document.getElementById('btn-cancel-persona-modal');

  // Modal Eliminación
  const modalDelete = document.getElementById('modal-persona-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete-persona');
  const btnCloseDelete = document.getElementById('btn-close-delete-persona-modal');
  const btnCancelDelete = document.getElementById('btn-cancel-delete-persona');

  // Event Listeners de Búsqueda y Filtro
  searchInput?.addEventListener('input', (e) => {
    filtrarPersonas(e.target.value.trim());
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ejecutarBusquedaDni(searchInput.value.trim());
    }
  });

  btnSearchDni?.addEventListener('click', () => {
    ejecutarBusquedaDni(searchInput.value.trim());
  });

  btnResetSearch?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    renderizarTabla(personasList);
  });

  btnRefresh?.addEventListener('click', () => {
    btnRefresh.classList.add('rotating');
    cargarPersonas().finally(() => {
      setTimeout(() => btnRefresh.classList.remove('rotating'), 600);
    });
  });

  // Modal de Crear / Editar
  btnNewPersona?.addEventListener('click', () => {
    abrirModalCrear();
  });

  btnCloseModal?.addEventListener('click', cerrarModalFormulario);
  btnCancelModal?.addEventListener('click', cerrarModalFormulario);

  formPersona?.addEventListener('submit', (e) => {
    e.preventDefault();
    guardarPersona();
  });

  // Modal de Eliminar
  btnConfirmDelete?.addEventListener('click', ejecutarEliminacion);
  btnCloseDelete?.addEventListener('click', cerrarModalEliminar);
  btnCancelDelete?.addEventListener('click', cerrarModalEliminar);

  // Cerrar modales con clic en overlay o tecla Escape
  [modalPersona, modalDelete].forEach((modal) => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('modal-active');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarModalFormulario();
      cerrarModalEliminar();
    }
  });

  // Cargar lista inicial
  cargarPersonas();
}

/**
 * Consulta la API y recarga la tabla de personas.
 */
export async function cargarPersonas() {
  const tableBody = document.getElementById('personas-table-body');
  const kpiTotal = document.getElementById('kpi-total-personas');

  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-state-cell">
          <div class="personas-spinner" aria-hidden="true"></div>
          <span>Consultando directorio de personas en SQL Server...</span>
        </td>
      </tr>
    `;
  }

  try {
    const data = await EcolifeAPI.listarPersonas();
    personasList = Array.isArray(data) ? data : [];

    if (kpiTotal) {
      kpiTotal.textContent = personasList.length;
    }

    renderizarTabla(personasList);
  } catch (error) {
    console.error('Error al cargar personas:', error);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-state-cell table-error-cell">
            <span style="font-size: 1.8rem;" aria-hidden="true">⚠️</span>
            <strong style="color: var(--status-critical-text);">Error de Conexión con el Backend</strong>
            <p style="font-size: 0.85rem; color: var(--eco-slate-600); margin: 0.35rem 0;">${escaparHTML(error.message)}</p>
            <button type="button" class="btn-secondary btn-sm" id="btn-retry-personas" style="margin-top: 0.5rem;">
              🔄 Reintentar
            </button>
          </td>
        </tr>
      `;
      document.getElementById('btn-retry-personas')?.addEventListener('click', cargarPersonas);
    }
    mostrarFeedback(`Error al conectar con la API de personas: ${error.message}`, 'error');
  }
}

/**
 * Renderiza los registros de personas en la tabla HTML.
 */
function renderizarTabla(personas) {
  const tableBody = document.getElementById('personas-table-body');
  if (!tableBody) return;

  if (!personas || personas.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-state-cell">
          <span style="font-size: 2.2rem;" aria-hidden="true">👥</span>
          <strong style="color: var(--eco-slate-800); margin-top: 0.35rem;">No se encontraron personas</strong>
          <p style="font-size: 0.85rem; color: var(--eco-slate-500); margin-top: 0.2rem;">
            No hay registros que coincidan con la búsqueda o el padrón está vacío.
          </p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = personas
    .map((p) => {
      const dni = p.dni;
      const nombre = p.nombre || '(Sin nombre)';
      const fechaNac = p.fechaNacimiento || p.fecha_nacimiento || '';
      const fechaFormateada = formatearFecha(fechaNac);
      const edad = calcularEdad(fechaNac);

      return `
      <tr data-dni="${escaparHTML(dni)}">
        <td>
          <span class="code-badge code-dni" title="DNI del ciudadano">${escaparHTML(dni)}</span>
        </td>
        <td>
          <div class="persona-name-cell">
            <strong class="persona-name">${escaparHTML(nombre)}</strong>
            <span class="persona-role-hint">Ciudadano Registrado</span>
          </div>
        </td>
        <td>
          <span class="persona-date">${escaparHTML(fechaFormateada)}</span>
        </td>
        <td>
          <span class="age-pill">${edad !== null ? `${edad} años` : 'No disponible'}</span>
        </td>
        <td style="text-align: right;">
          <div class="table-actions-group">
            <button
              type="button"
              class="btn-action-edit"
              data-dni="${escaparHTML(dni)}"
              title="Editar datos de ${escaparHTML(nombre)}"
              aria-label="Editar ${escaparHTML(nombre)}"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <span>Editar</span>
            </button>
            <button
              type="button"
              class="btn-action-delete"
              data-dni="${escaparHTML(dni)}"
              data-nombre="${escaparHTML(nombre)}"
              title="Eliminar registro de ${escaparHTML(nombre)}"
              aria-label="Eliminar ${escaparHTML(nombre)}"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  // Vincular eventos de los botones de acción en cada fila
  tableBody.querySelectorAll('.btn-action-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dni = btn.getAttribute('data-dni');
      abrirModalEditar(dni);
    });
  });

  tableBody.querySelectorAll('.btn-action-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dni = btn.getAttribute('data-dni');
      const nombre = btn.getAttribute('data-nombre');
      abrirModalEliminar(dni, nombre);
    });
  });
}

/**
 * Filtro local en memoria mientras se escribe en el buscador.
 */
function filtrarPersonas(termino) {
  if (!termino) {
    renderizarTabla(personasList);
    return;
  }
  const t = termino.toLowerCase();
  const filtradas = personasList.filter((p) => {
    const dni = (p.dni || '').toLowerCase();
    const nombre = (p.nombre || '').toLowerCase();
    return dni.includes(t) || nombre.includes(t);
  });
  renderizarTabla(filtradas);
}

/**
 * Ejecuta búsqueda directa contra el endpoint GET /personas/{dni} si el usuario
 * ingresó un DNI de 8 dígitos, o filtra localmente si es texto general.
 */
async function ejecutarBusquedaDni(termino) {
  if (!termino) {
    cargarPersonas();
    return;
  }

  // Si son exactamente 8 dígitos numéricos, consultar directamente a la API GET /personas/{dni}
  if (/^\d{8}$/.test(termino)) {
    const tableBody = document.getElementById('personas-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-state-cell">
            <div class="personas-spinner" aria-hidden="true"></div>
            <span>Buscando persona con DNI ${escaparHTML(termino)} en la API...</span>
          </td>
        </tr>
      `;
    }

    try {
      const persona = await EcolifeAPI.obtenerPersona(termino);
      renderizarTabla([persona]);
      mostrarFeedback(`Persona encontrada por DNI: ${persona.nombre}`, 'success');
    } catch (err) {
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="table-state-cell table-error-cell">
              <span style="font-size: 2rem;" aria-hidden="true">🔍</span>
              <strong style="color: var(--status-critical-text);">Persona no encontrada</strong>
              <p style="font-size: 0.85rem; color: var(--eco-slate-600); margin: 0.35rem 0;">
                ${escaparHTML(err.message)}
              </p>
              <button type="button" class="btn-secondary btn-sm" id="btn-show-all-personas" style="margin-top: 0.5rem;">
                Ver Todas las Personas
              </button>
            </td>
          </tr>
        `;
        document.getElementById('btn-show-all-personas')?.addEventListener('click', () => {
          const searchInput = document.getElementById('personas-search-input');
          if (searchInput) searchInput.value = '';
          renderizarTabla(personasList);
        });
      }
    }
  } else {
    filtrarPersonas(termino);
  }
}

/**
 * Abre el modal para crear una nueva persona.
 */
function abrirModalCrear() {
  editingDni = null;
  const modal = document.getElementById('modal-persona-form');
  const title = document.getElementById('modal-persona-title');
  const subtitle = document.getElementById('modal-persona-subtitle');
  const dniInput = document.getElementById('persona-dni');
  const nombreInput = document.getElementById('persona-nombre');
  const fechaInput = document.getElementById('persona-fecha-nac');
  const dniHelp = document.getElementById('persona-dni-help');
  const errorBox = document.getElementById('modal-persona-error');
  const btnSubmit = document.getElementById('btn-submit-persona');

  if (title) title.textContent = 'Registrar Nueva Persona';
  if (subtitle) subtitle.textContent = 'Ingresa el DNI, nombre completo y fecha de nacimiento.';
  if (btnSubmit) btnSubmit.innerHTML = '<span>➕ Registrar Persona</span>';

  if (dniInput) {
    dniInput.value = '';
    dniInput.disabled = false;
    dniInput.readOnly = false;
    dniInput.focus();
  }
  if (nombreInput) nombreInput.value = '';
  if (fechaInput) fechaInput.value = '';
  if (dniHelp) dniHelp.textContent = 'Documento Nacional de Identidad de 8 dígitos numéricos.';
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  modal?.classList.add('modal-active');
}

/**
 * Abre el modal en modo edición con los datos actuales precargados.
 */
async function abrirModalEditar(dni) {
  editingDni = dni;
  const modal = document.getElementById('modal-persona-form');
  const title = document.getElementById('modal-persona-title');
  const subtitle = document.getElementById('modal-persona-subtitle');
  const dniInput = document.getElementById('persona-dni');
  const nombreInput = document.getElementById('persona-nombre');
  const fechaInput = document.getElementById('persona-fecha-nac');
  const dniHelp = document.getElementById('persona-dni-help');
  const errorBox = document.getElementById('modal-persona-error');
  const btnSubmit = document.getElementById('btn-submit-persona');

  if (title) title.textContent = 'Editar Datos de Persona';
  if (subtitle) subtitle.textContent = `Actualiza los datos asociados al DNI ${dni}.`;
  if (btnSubmit) btnSubmit.innerHTML = '<span>💾 Guardar Cambios</span>';

  // Buscar persona en caché o en API
  let persona = personasList.find((p) => p.dni === dni);
  if (!persona) {
    try {
      persona = await EcolifeAPI.obtenerPersona(dni);
    } catch (err) {
      mostrarFeedback(`Error al obtener datos de la persona: ${err.message}`, 'error');
      return;
    }
  }

  if (dniInput) {
    dniInput.value = persona.dni;
    dniInput.disabled = true; // El DNI no se puede modificar según la especificación
    dniInput.readOnly = true;
  }
  if (nombreInput) {
    nombreInput.value = persona.nombre;
    nombreInput.focus();
  }
  if (fechaInput) {
    const rawFecha = persona.fechaNacimiento || persona.fecha_nacimiento || '';
    fechaInput.value = rawFecha.split('T')[0];
  }
  if (dniHelp) {
    dniHelp.textContent = 'El DNI es el identificador único y no puede ser modificado.';
  }
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  modal?.classList.add('modal-active');
}

/**
 * Cierra el modal de formulario.
 */
function cerrarModalFormulario() {
  const modal = document.getElementById('modal-persona-form');
  modal?.classList.remove('modal-active');
  editingDni = null;
}

/**
 * Envía el formulario para crear (POST) o editar (PUT).
 */
async function guardarPersona() {
  const dniInput = document.getElementById('persona-dni');
  const nombreInput = document.getElementById('persona-nombre');
  const fechaInput = document.getElementById('persona-fecha-nac');
  const btnSubmit = document.getElementById('btn-submit-persona');
  const errorBox = document.getElementById('modal-persona-error');

  const dni = dniInput ? dniInput.value.trim() : '';
  const nombre = nombreInput ? nombreInput.value.trim() : '';
  const fechaNacimiento = fechaInput ? fechaInput.value : '';

  // Validaciones en cliente antes de invocar la API
  if (!editingDni) {
    if (!/^\d{8}$/.test(dni)) {
      mostrarErrorModal('El DNI debe contener exactamente 8 dígitos numéricos.');
      dniInput?.focus();
      return;
    }
  }

  if (!nombre || nombre.length < 1 || nombre.length > 100) {
    mostrarErrorModal('El nombre debe tener entre 1 y 100 caracteres.');
    nombreInput?.focus();
    return;
  }

  if (!fechaNacimiento) {
    mostrarErrorModal('Por favor selecciona una fecha de nacimiento válida.');
    fechaInput?.focus();
    return;
  }

  const hoy = new Date().toISOString().split('T')[0];
  if (fechaNacimiento > hoy) {
    mostrarErrorModal('La fecha de nacimiento no puede ser una fecha futura.');
    fechaInput?.focus();
    return;
  }

  if (errorBox) errorBox.style.display = 'none';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>⏳ Guardando en SQL Server...</span>';
  }

  try {
    if (editingDni) {
      // Modo Edición: PUT /personas/{dni}
      const payload = {
        nombre: nombre,
        fechaNacimiento: fechaNacimiento,
      };
      await EcolifeAPI.actualizarPersona(editingDni, payload);
      cerrarModalFormulario();
      mostrarFeedback(`¡Persona ${nombre} actualizada exitosamente!`, 'success');
    } else {
      // Modo Creación: POST /personas
      const payload = {
        dni: dni,
        nombre: nombre,
        fechaNacimiento: fechaNacimiento,
      };
      await EcolifeAPI.crearPersona(payload);
      cerrarModalFormulario();
      mostrarFeedback(`¡Persona con DNI ${dni} registrada con éxito en el sistema!`, 'success');
    }

    // Refrescar tabla automáticamente tras la operación
    await cargarPersonas();
  } catch (error) {
    console.error('Error al guardar persona:', error);
    mostrarErrorModal(error.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = editingDni
        ? '<span>💾 Guardar Cambios</span>'
        : '<span>➕ Registrar Persona</span>';
    }
  }
}

/**
 * Muestra el mensaje de error dentro del modal.
 */
function mostrarErrorModal(mensaje) {
  const errorBox = document.getElementById('modal-persona-error');
  if (errorBox) {
    errorBox.textContent = mensaje;
    errorBox.style.display = 'block';
  }
}

/**
 * Abre el modal de confirmación de eliminación.
 */
function abrirModalEliminar(dni, nombre) {
  deletingDni = dni;
  const modal = document.getElementById('modal-persona-delete');
  const dniSpan = document.getElementById('delete-persona-dni');
  const nombreSpan = document.getElementById('delete-persona-name');

  if (dniSpan) dniSpan.textContent = dni;
  if (nombreSpan) nombreSpan.textContent = nombre;

  modal?.classList.add('modal-active');
}

/**
 * Cierra el modal de confirmación de eliminación.
 */
function cerrarModalEliminar() {
  const modal = document.getElementById('modal-persona-delete');
  modal?.classList.remove('modal-active');
  deletingDni = null;
}

/**
 * Ejecuta la eliminación (DELETE /personas/{dni}) tras la confirmación del usuario.
 */
async function ejecutarEliminacion() {
  if (!deletingDni) return;

  const btnConfirm = document.getElementById('btn-confirm-delete-persona');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Eliminando...';
  }

  const dniEliminado = deletingDni;

  try {
    await EcolifeAPI.eliminarPersona(dniEliminado);
    cerrarModalEliminar();
    mostrarFeedback(`Persona con DNI ${dniEliminado} eliminada correctamente de la base de datos.`, 'success');
    await cargarPersonas();
  } catch (error) {
    console.error('Error al eliminar persona:', error);
    mostrarFeedback(`No se pudo eliminar la persona con DNI ${dniEliminado}: ${error.message}`, 'error');
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Sí, Eliminar Persona';
    }
  }
}

/**
 * Muestra un banner de feedback (éxito o error) en la parte superior del módulo.
 */
function mostrarFeedback(mensaje, tipo = 'success') {
  const banner = document.getElementById('personas-feedback-banner');
  if (!banner) return;

  banner.className = `personas-feedback-banner feedback-${tipo}`;
  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.65rem;">
      <span aria-hidden="true">${tipo === 'success' ? '✅' : '⚠️'}</span>
      <span>${escaparHTML(mensaje)}</span>
    </div>
    <button type="button" class="btn-close-feedback" aria-label="Cerrar notificación">&times;</button>
  `;
  banner.style.display = 'flex';

  banner.querySelector('.btn-close-feedback')?.addEventListener('click', () => {
    banner.style.display = 'none';
  });

  // Auto-ocultar después de 6 segundos si es de éxito
  if (tipo === 'success') {
    setTimeout(() => {
      if (banner.style.display !== 'none') {
        banner.style.display = 'none';
      }
    }, 6000);
  }
}

/**
 * Calcula la edad a partir de la fecha de nacimiento en formato YYYY-MM-DD.
 */
function calcularEdad(fechaStr) {
  if (!fechaStr) return null;
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const m = hoy.getMonth() - fecha.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fecha.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : null;
}

/**
 * Formatea una fecha ISO o YYYY-MM-DD a DD/MM/AAAA.
 */
function formatearFecha(fechaStr) {
  if (!fechaStr) return 'No registrada';
  const partes = fechaStr.split('T')[0].split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return fechaStr;
}

/**
 * Sanitiza texto para evitar inyecciones HTML en la renderización.
 */
function escaparHTML(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
