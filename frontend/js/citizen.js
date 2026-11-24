/**
 * ECOLIFE - Módulo 1: Vista Ciudadano (Mobile-First)
 * Controlador de geolocalización, evidencia fotográfica y envío de reportes.
 */

import { EcolifeAPI } from './api.js';

let fotoEvidenciaBase64 = null;
let coordsCapturadas = { lat: -12.0653, lng: -75.2049 }; // Huancayo por defecto

export function initCitizenModule() {
  const btnGps = document.getElementById('btn-capture-gps');
  const gpsStatusText = document.getElementById('gps-status-text');
  const inputLat = document.getElementById('input-lat');
  const inputLng = document.getElementById('input-lng');
  const inputDistrict = document.getElementById('input-district');
  const inputAddress = document.getElementById('input-address');
  const inputPhoto = document.getElementById('input-photo');
  const photoPreview = document.getElementById('photo-preview');
  const photoImg = document.getElementById('photo-preview-img');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');
  const photoUploadZone = document.getElementById('photo-upload-zone');
  const formReport = document.getElementById('form-green-alert');
  const inputDetails = document.getElementById('input-details');
  const charCounter = document.getElementById('char-count');
  const btnSubmit = document.getElementById('btn-submit-report');
  const modalSuccess = document.getElementById('modal-report-success');
  const modalCodeDisplay = document.getElementById('modal-report-code');
  const btnCloseSuccessModal = document.getElementById('btn-close-success');
  const btnCopyCode = document.getElementById('btn-copy-code');

  // Copiar código de seguimiento al portapapeles
  btnCopyCode?.addEventListener('click', async () => {
    const code = modalCodeDisplay?.textContent?.trim() || '';
    if (!code) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback para navegadores antiguos
        const tempInput = document.createElement('input');
        tempInput.value = code;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      btnCopyCode.innerHTML = '<span>✅ ¡Copiado con Éxito!</span>';
      setTimeout(() => {
        btnCopyCode.innerHTML = '<span>📋 Copiar Código</span>';
      }, 2200);
    } catch (err) {
      console.warn('Fallo al copiar código al portapapeles:', err);
    }
  });

  // 1. Geolocalización GPS
  btnGps?.addEventListener('click', () => {
    btnGps.innerHTML = '<span>🛰️ Adquiriendo señal GPS...</span>';
    btnGps.disabled = true;

    if (!navigator.geolocation) {
      aplicarCoordenadas(-12.0653, -75.2049, 'Huancayo Centro (Simulado por navegador)');
      restaurarBotonGps();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        aplicarCoordenadas(latitude, longitude, 'Ubicación GPS precisa adquirida');
        restaurarBotonGps(true);
      },
      (err) => {
        console.warn('Acceso GPS no concedido o fuera de rango:', err.message);
        // Coordenadas céntricas de Huancayo como respaldo
        aplicarCoordenadas(-12.0653, -75.2049, 'Huancayo Centro (-12.0653, -75.2049)');
        restaurarBotonGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  function aplicarCoordenadas(lat, lng, desc) {
    coordsCapturadas = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
    if (inputLat) inputLat.value = coordsCapturadas.lat;
    if (inputLng) inputLng.value = coordsCapturadas.lng;
    if (gpsStatusText) {
      gpsStatusText.textContent = `${coordsCapturadas.lat}, ${coordsCapturadas.lng}`;
    }
  }

  function restaurarBotonGps(exito = true) {
    btnGps.disabled = false;
    btnGps.classList.add('gps-active');
    btnGps.innerHTML = exito
      ? '<span>✅ GPS Fijado con Éxito</span>'
      : '<span>📍 Ubicación Huancayo Asignada</span>';
  }

  // 2. Contador de Caracteres
  inputDetails?.addEventListener('input', () => {
    const len = inputDetails.value.length;
    if (charCounter) {
      charCounter.textContent = `${len} / 1500`;
    }
  });

  // 3. Captura y Previsualización de Evidencia Fotográfica
  inputPhoto?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      procesarArchivoImagen(file);
    }
  });

  // Drag and drop sobre la zona de subida
  photoUploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    photoUploadZone.style.borderColor = 'var(--eco-green-700)';
  });

  photoUploadZone?.addEventListener('dragleave', () => {
    photoUploadZone.style.borderColor = 'var(--eco-slate-300)';
  });

  photoUploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    photoUploadZone.style.borderColor = 'var(--eco-slate-300)';
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      procesarArchivoImagen(file);
    }
  });

  function procesarArchivoImagen(file) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      fotoEvidenciaBase64 = event.target?.result;
      if (photoImg) photoImg.src = fotoEvidenciaBase64;
      if (photoPreview) photoPreview.style.display = 'block';
      if (photoUploadZone) photoUploadZone.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  btnRemovePhoto?.addEventListener('click', () => {
    fotoEvidenciaBase64 = null;
    if (inputPhoto) inputPhoto.value = '';
    if (photoPreview) photoPreview.style.display = 'none';
    if (photoUploadZone) photoUploadZone.style.display = 'block';
  });

  // 4. Envío del Formulario
  formReport?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Obtener tipo de residuo seleccionado
    const selectedWasteRadio = document.querySelector('input[name="waste_type"]:checked');
    if (!selectedWasteRadio) {
      alert('Por favor selecciona el tipo de residuo contaminante.');
      return;
    }

    const tipoResiduo = selectedWasteRadio.value;
    const direccion = inputAddress?.value.trim() || 'Av. Ferrocarril / Río Shullcas';
    const distrito = inputDistrict?.value || 'Huancayo Centro';
    const detalles = inputDetails?.value.trim();

    if (!detalles || detalles.length < 5) {
      alert('Por favor ingresa más detalles sobre el foco contaminante (mínimo 5 caracteres).');
      return;
    }

    // Estado visual de carga
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>⏳ Enviando Reporte a Fiscalización...</span>';
    }

    const payload = {
      latitud: coordsCapturadas.lat,
      longitud: coordsCapturadas.lng,
      direccionReferencia: direccion,
      distrito: distrito,
      tipoResiduo: tipoResiduo,
      detalles: detalles,
      evidenciaUrl: fotoEvidenciaBase64 || 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80',
    };

    try {
      const reporteCreado = await EcolifeAPI.registrarIncidente(payload);

      // Mostrar modal de confirmación cívica con el código
      if (modalCodeDisplay) {
        modalCodeDisplay.textContent = reporteCreado.codigoAlerta || 'ECO-HYO-1099';
      }
      if (modalSuccess) {
        modalSuccess.classList.add('modal-active');
      }

      // Limpiar formulario
      formReport.reset();
      fotoEvidenciaBase64 = null;
      if (photoPreview) photoPreview.style.display = 'none';
      if (photoUploadZone) photoUploadZone.style.display = 'block';
      if (charCounter) charCounter.textContent = '0 / 1500';

      // Notificar al dashboard si está escuchando
      window.dispatchEvent(new CustomEvent('ecolife:new-report', { detail: reporteCreado }));
    } catch (err) {
      alert(`Ocurrió un inconveniente al enviar tu reporte: ${err.message}`);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>🚀 Enviar Reporte Ambiental</span>';
      }
    }
  });

  btnCloseSuccessModal?.addEventListener('click', () => {
    if (modalSuccess) modalSuccess.classList.remove('modal-active');
  });
}
