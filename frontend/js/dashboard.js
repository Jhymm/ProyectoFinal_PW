/**
 * ECOLIFE - Módulo 2: Panel de Fiscalización (Centro de Monitoreo - Vista Desktop)
 * Controlador de métricas KPI, mapa topográfico de Huancayo y bandeja de incidentes.
 */

import { EcolifeAPI } from './api.js';

let leafletMap = null;
let incidentMarkers = [];
let allIncidents = [];
let selectedIncidentForAction = null;

export function initDashboardModule() {
  const tableBody = document.getElementById('incident-table-body');
  const searchInput = document.getElementById('search-incident-input');
  const filterSelect = document.getElementById('filter-status-select');
  const btnRefresh = document.getElementById('btn-refresh-dashboard');
  const modalAction = document.getElementById('modal-action-incident');
  const modalActionTitle = document.getElementById('modal-action-title');
  const modalActionCode = document.getElementById('modal-action-code');
  const modalActionImg = document.getElementById('modal-action-img');
  const modalActionAddress = document.getElementById('modal-action-address');
  const modalActionDetails = document.getElementById('modal-action-details');
  const selectNewStatus = document.getElementById('select-new-status');
  const inputActionNotes = document.getElementById('input-action-notes');
  const btnSaveStatus = document.getElementById('btn-save-status');
  const btnCloseActionModal = document.getElementById('btn-close-action-modal');
  const btnCancelActionModal = document.getElementById('btn-cancel-action-modal');

  // Inicializar Mapa de Huancayo
  initHuancayoMap();

  // Cargar datos iniciales
  cargarDatosDashboard();

  // Escuchar nuevos reportes desde la vista ciudadana
  window.addEventListener('ecolife:new-report', (event) => {
    console.log('Nuevo reporte detectado en vivo:', event.detail);
    cargarDatosDashboard();
  });

  // Filtros y Búsqueda
  searchInput?.addEventListener('input', () => {
    aplicarFiltrosTabla();
  });

  filterSelect?.addEventListener('change', () => {
    aplicarFiltrosTabla();
  });

  btnRefresh?.addEventListener('click', () => {
    btnRefresh.classList.add('rotating');
    cargarDatosDashboard().finally(() => {
      setTimeout(() => btnRefresh.classList.remove('rotating'), 600);
    });
  });

  // Modal de Acción
  btnCloseActionModal?.addEventListener('click', cerrarModalAccion);
  btnCancelActionModal?.addEventListener('click', cerrarModalAccion);

  btnSaveStatus?.addEventListener('click', async () => {
    if (!selectedIncidentForAction) return;

    const nuevoEstado = selectNewStatus.value;
    const observaciones = inputActionNotes.value.trim();

    btnSaveStatus.disabled = true;
    btnSaveStatus.textContent = 'Guardando...';

    try {
      await EcolifeAPI.actualizarEstado(selectedIncidentForAction.id, {
        estado: nuevoEstado,
        observacionesFiscalizacion: observaciones,
      });
      cerrarModalAccion();
      await cargarDatosDashboard();
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    } finally {
      btnSaveStatus.disabled = false;
      btnSaveStatus.textContent = 'Actualizar Estado';
    }
  });

  function cerrarModalAccion() {
    if (modalAction) modalAction.classList.remove('modal-active');
    selectedIncidentForAction = null;
  }
}

/**
 * Inicializa el mapa interactivo con Leaflet centrado en el área metropolitana de Huancayo
 */
function initHuancayoMap() {
  const mapElement = document.getElementById('huancayo-map');
  if (!mapElement || typeof L === 'undefined') return;

  // Coordenadas céntricas de Huancayo, Junín, Perú
  const huancayoCenter = [-12.0653, -75.2049];

  if (!leafletMap) {
    leafletMap = L.map('huancayo-map', {
      center: huancayoCenter,
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: false, // Deshabilitado inicialmente para evitar secuestro de scroll táctil en móvil
    });

    // Habilitar zoom por rueda solo cuando el usuario interactúe explícitamente con el mapa
    mapElement.addEventListener('click', () => {
      if (leafletMap && !leafletMap.scrollWheelZoom.enabled()) {
        leafletMap.scrollWheelZoom.enable();
      }
    });

    mapElement.addEventListener('mouseleave', () => {
      if (leafletMap && leafletMap.scrollWheelZoom.enabled()) {
        leafletMap.scrollWheelZoom.disable();
      }
    });

    // Capa de mosaico topográfico/urbano de alta legibilidad
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(leafletMap);
  }
}

/**
 * Carga incidentes y métricas desde la API
 */
async function cargarDatosDashboard() {
  try {
    const [metricas, incidentes] = await Promise.all([
      EcolifeAPI.obtenerMetricas(),
      EcolifeAPI.listarIncidentes(),
    ]);

    renderKPIs(metricas);
    allIncidents = incidentes;
    aplicarFiltrosTabla();
    renderMapMarkers(allIncidents);
  } catch (err) {
    console.error('Error cargando datos del dashboard:', err);
  }
}

/**
 * Renderiza las 4 tarjetas de KPIs
 */
function renderKPIs(metricas) {
  const elTotal = document.getElementById('kpi-total-val');
  const elCritical = document.getElementById('kpi-critical-val');
  const elResolved = document.getElementById('kpi-resolved-val');
  const elTime = document.getElementById('kpi-time-val');

  if (elTotal) elTotal.textContent = metricas.totalAlertas ?? 0;
  if (elCritical) elCritical.textContent = metricas.puntosCriticos ?? 0;
  if (elResolved) elResolved.textContent = metricas.alertasAtendidas ?? 0;
  if (elTime) elTime.textContent = metricas.tiempoPromedioRespuesta ?? '3.5 horas';
}

/**
 * Renderiza los marcadores en el mapa de Leaflet
 */
function renderMapMarkers(incidentes) {
  if (!leafletMap || typeof L === 'undefined') return;

  // Limpiar marcadores previos
  incidentMarkers.forEach((m) => leafletMap.removeLayer(m));
  incidentMarkers = [];

  incidentes.forEach((inc) => {
    let colorHex = '#D97706'; // Pendiente (ámbar)
    let labelEstado = inc.estado;

    if (inc.estado === 'Resuelto') {
      colorHex = '#059669'; // Verde
    } else if (inc.estado === 'En proceso') {
      colorHex = '#2563EB'; // Azul
    } else if (inc.gravedad === 'Crítica' || inc.gravedad === 'Alta') {
      colorHex = '#DC2626'; // Rojo crítico
    }

    // Crear icono SVG personalizado
    const customIcon = L.divIcon({
      className: 'custom-eco-marker',
      html: `
        <div style="
          width: 30px;
          height: 30px;
          background-color: ${colorHex};
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 13px;
          font-weight: 800;
        ">
          ${inc.gravedad === 'Crítica' ? '⚠️' : '📍'}
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });

    const marker = L.marker([inc.latitud, inc.longitud], { icon: customIcon });

    const popupHtml = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 200px; max-width: 260px;">
        <span style="font-family: monospace; font-weight: 800; color: #064E3B; font-size: 12px;">${inc.codigoAlerta}</span>
        <h4 style="font-size: 14px; font-weight: 700; margin: 4px 0; color: #0F172A;">${inc.tipoResiduo}</h4>
        <p style="font-size: 12px; color: #64748B; margin-bottom: 6px;">📍 ${inc.direccionReferencia} (${inc.distrito})</p>
        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: ${colorHex}22; color: ${colorHex};">
          ${labelEstado} • Gravedad ${inc.gravedad}
        </span>
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.addTo(leafletMap);
    incidentMarkers.push(marker);
  });
}

/**
 * Filtra y renderiza la tabla de datos
 */
function aplicarFiltrosTabla() {
  const searchInput = document.getElementById('search-incident-input');
  const filterSelect = document.getElementById('filter-status-select');
  const query = searchInput?.value.toLowerCase().trim() || '';
  const filterStatus = filterSelect?.value || 'Todos';

  const filtered = allIncidents.filter((inc) => {
    const coincideEstado = filterStatus === 'Todos' || inc.estado === filterStatus;
    const coincideTexto =
      !query ||
      inc.codigoAlerta.toLowerCase().includes(query) ||
      inc.direccionReferencia.toLowerCase().includes(query) ||
      inc.distrito.toLowerCase().includes(query) ||
      inc.tipoResiduo.toLowerCase().includes(query);

    return coincideEstado && coincideTexto;
  });

  renderTableRows(filtered);
}

/**
 * Inserta las filas en el cuerpo de la tabla de incidentes
 */
function renderTableRows(incidentes) {
  const tbody = document.getElementById('incident-table-body');
  if (!tbody) return;

  if (incidentes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--eco-slate-500);">
          No se encontraron reportes con los filtros aplicados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = incidentes
    .map((inc) => {
      let statusClass = 'status-pending';
      if (inc.estado === 'En proceso') statusClass = 'status-process';
      if (inc.estado === 'Resuelto') statusClass = 'status-resolved';

      return `
        <tr>
          <td><span class="code-badge">${inc.codigoAlerta}</span></td>
          <td>
            <div class="location-cell">
              <span class="location-address">${inc.direccionReferencia}</span>
              <span class="location-district">📍 ${inc.distrito}</span>
            </div>
          </td>
          <td>
            <strong style="color: var(--eco-slate-900); font-size: 0.825rem;">${inc.tipoResiduo}</strong>
          </td>
          <td>
            <span class="status-pill ${statusClass}">
              ● ${inc.estado}
            </span>
          </td>
          <td>
            <button
              class="btn-action-table"
              data-id="${inc.id}"
              aria-label="Atender reporte ${inc.codigoAlerta}"
            >
              Atender / Detalle
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  // Asociar eventos a los botones de acción
  tbody.querySelectorAll('.btn-action-table').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      abrirModalAccion(id);
    });
  });
}

/**
 * Abre el modal de detalle y cambio de estado
 */
function abrirModalAccion(idIncidente) {
  const inc = allIncidents.find((i) => i.id === idIncidente);
  if (!inc) return;

  selectedIncidentForAction = inc;

  const modalAction = document.getElementById('modal-action-incident');
  const modalActionTitle = document.getElementById('modal-action-title');
  const modalActionCode = document.getElementById('modal-action-code');
  const modalActionImg = document.getElementById('modal-action-img');
  const modalActionAddress = document.getElementById('modal-action-address');
  const modalActionDetails = document.getElementById('modal-action-details');
  const selectNewStatus = document.getElementById('select-new-status');
  const inputActionNotes = document.getElementById('input-action-notes');

  if (modalActionTitle) modalActionTitle.textContent = `Gestión: ${inc.tipoResiduo}`;
  if (modalActionCode) modalActionCode.textContent = inc.codigoAlerta;
  if (modalActionAddress) modalActionAddress.textContent = `${inc.direccionReferencia} (${inc.distrito})`;
  if (modalActionDetails) modalActionDetails.textContent = inc.detalles;
  if (selectNewStatus) selectNewStatus.value = inc.estado;
  if (inputActionNotes) inputActionNotes.value = inc.observacionesFiscalizacion || '';

  if (modalActionImg) {
    if (inc.evidenciaUrl) {
      modalActionImg.src = inc.evidenciaUrl;
      modalActionImg.style.display = 'block';
    } else {
      modalActionImg.style.display = 'none';
    }
  }

  if (modalAction) modalAction.classList.add('modal-active');
}
