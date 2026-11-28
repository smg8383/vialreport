// 🌍 INICIALIZACIÓN GLOBAL DE SUPABASE (Fuera del DOMContentLoaded para estar disponible de inmediato)
const supabaseClient = supabase.createClient(
  "https://yepethuzzretakioqyqy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcGV0aHV6enJldGFraW9xeXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTQwMDcsImV4cCI6MjA5MDUzMDAwN30.1sRjLDe56C7ILa6n3zNHjbC9cl4nAwr-Pkp--uzoXQs"
);
window.supabaseClient = supabaseClient; // Exponer globalmente para el mapa y el GPS del HTML

document.addEventListener("DOMContentLoaded", async () => {

const STORAGE_KEY_CAMPOS_NUEVO = "vialReportCamposNuevoRegistro";

function obtenerFechaHoyLocal() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

// 🚪 CERRAR SESIÓN
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    if (!confirm("¿Querés cerrar sesión para ingresar con otra cuenta?")) return;
    await supabaseClient.auth.signOut();
    localStorage.removeItem("editandoInforme");
    localStorage.removeItem("editandoInformeCoords");
    window.location.href = "login.html";
  });
}

// 🏢 OBTENER ORGANIZACIÓN DEL USUARIO DESDE "empresas"
async function obtenerOrganizacionUsuario(userId) {
  const { data, error } = await supabaseClient
    .from("empresas")
    .select("nombre")
    .eq("user_id", userId)
    .single();

  if (error || !data?.nombre) {
    console.warn("No se encontró organización asociada al usuario:", error);
    return null;
  }

  return data.nombre;
}

// 🌩 CLOUDINARY
const CLOUD_NAME = "ddgc2azm8";
const UPLOAD_PRESET = "unsigned_upload";

// 🔥 SUBIR IMAGEN CON PROGRESS
function subirACloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    xhr.open("POST", url);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded * 100) / e.total);
        onProgress(percent);
      }
    });

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (res.secure_url) {
          resolve(res.secure_url);
        } else {
          reject(new Error("Respuesta de Cloudinary sin secure_url"));
        }
      } catch (err) {
        reject(err);
      }
    };

    xhr.onerror = () => reject(new Error("Error de red al subir a Cloudinary"));

    xhr.send(formData);
  });
}

// 🧠 COMPRESIÓN SEGURA
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    reader.onerror = () => resolve(file);

    img.onload = () => {
      try {
        const maxWidth = 1200;
        const anchoOriginal = img.width || maxWidth;
        const altoOriginal = img.height || maxWidth;
        const scale = anchoOriginal > maxWidth ? maxWidth / anchoOriginal : 1;

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(anchoOriginal * scale));
        canvas.height = Math.max(1, Math.round(altoOriginal * scale));

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const nuevoNombre = (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
            resolve(new File([blob], nuevoNombre, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.7
        );
      } catch (_) {
        resolve(file);
      }
    };

    img.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// 🌐 CARGAR TAREAS DESDE SUPABASE
let tareasCache = [];

function llenarSelectsTareas(data) {
  document.querySelectorAll(".tarea-select").forEach((select) => {
    select.innerHTML = "";

    let currentTarea = "";

    (data || []).forEach((item) => {
      if (!item?.subtarea) return;
      const tareaLabel = item.tarea || "SIN TAREA";
      const subtareaVal = String(item.subtarea).trim().toUpperCase();

      if (tareaLabel !== currentTarea) {
        currentTarea = tareaLabel;

        const optGroup = document.createElement("optgroup");
        optGroup.label = currentTarea;
        select.appendChild(optGroup);

        const option = document.createElement("option");
        option.value = subtareaVal;
        option.textContent = subtareaVal;

        optGroup.appendChild(option);
      } else {
        const optGroup = select.querySelector(
          `optgroup[label="${CSS.escape(currentTarea)}"]`
        );

        const option = document.createElement("option");
        option.value = subtareaVal;
        option.textContent = subtareaVal;

        if (optGroup) optGroup.appendChild(option);
        else select.appendChild(option);
      }
    });
  });
}

async function cargarTareasJerarquicas(forceRefresh = false) {
  if (!forceRefresh && tareasCache.length > 0) {
    llenarSelectsTareas(tareasCache);
    return tareasCache;
  }

  const { data, error } = await supabaseClient
    .from("tareas")
    .select("*")
    .order("tarea", { ascending: true })
    .order("subtarea", { ascending: true });

  if (error) {
    console.error("Error cargando tareas:", error);
    return [];
  }

  tareasCache = data || [];
  llenarSelectsTareas(tareasCache);
  return tareasCache;
}

// ➕ AGREGAR NUEVA TAREA / SUBTAREA EN SUPABASE
const btnGuardarNuevaTarea = document.getElementById("btnGuardarNuevaTarea");
if (btnGuardarNuevaTarea) {
  btnGuardarNuevaTarea.addEventListener("click", async () => {
    const inputTarea = document.getElementById("nuevaTareaNombre");
    const inputSubtarea = document.getElementById("nuevaSubtareaNombre");

    const tarea = (inputTarea?.value || "").trim();
    const subtarea = (inputSubtarea?.value || "").trim();

    if (!tarea || !subtarea) {
      alert("Completá tanto la tarea principal como la subtarea.");
      return;
    }

    const textoOriginal = btnGuardarNuevaTarea.innerHTML;
    btnGuardarNuevaTarea.disabled = true;
    btnGuardarNuevaTarea.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Guardando...`;

    try {
      const { error } = await supabaseClient
        .from("tareas")
        .insert([{ tarea, subtarea }]);

      if (error) {
        console.error("Error al guardar nueva tarea:", error);
        alert("No se pudo guardar la tarea en Supabase: " + error.message);
        return;
      }

      await cargarTareasJerarquicas(true);

      const valorSeleccionado = subtarea.toUpperCase();
      document.querySelectorAll(".tarea-select").forEach((select) => {
        select.value = valorSeleccionado;
      });

      if (inputTarea) inputTarea.value = "";
      if (inputSubtarea) inputSubtarea.value = "";

      const modalEl = document.getElementById("modalNuevaTarea");
      const modalInstancia = bootstrap.Modal.getInstance(modalEl);
      if (modalInstancia) modalInstancia.hide();

      alert("Nueva tarea agregada correctamente ✅");
    } catch (err) {
      console.error("Error inesperado al agregar tarea:", err);
      alert("Ocurrió un error al guardar la tarea.");
    } finally {
      btnGuardarNuevaTarea.disabled = false;
      btnGuardarNuevaTarea.innerHTML = textoOriginal;
    }
  });
}

// 🔹 FORM PREVIEW DE IMAGENES
document.addEventListener("change", (e) => {
  if (e.target.classList.contains("fotos")) {
    const input = e.target;
    const files = Array.from(input.files || []);

    if (files.length > 4) {
      alert("Máximo 4 imágenes");
      input.value = "";
      return;
    }

    const preview = input.closest(".grupo")?.querySelector(".preview");
    if (!preview) return;
    preview.innerHTML = "";

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.innerHTML += `<div class="col-md-3 mb-2">
          <img src="${ev.target.result}" class="img-fluid rounded border">
        </div>`;
      };
      reader.readAsDataURL(file);
    });
  }
});

// 🔹 ESTADO DE EDICIÓN E IMÁGENES EXISTENTES
let editandoId = localStorage.getItem("editandoInforme");
let imagenesExistentes = [];

function renderImagenesActuales() {
  const cont = document.getElementById("imagenesActuales");
  if (!cont) return;
  cont.innerHTML = "";

  imagenesExistentes.forEach((img, index) => {
    cont.innerHTML += `<div class="col-md-3 mb-2 text-center">
      <img src="${img}" class="img-fluid rounded border mb-1">
      <br>
      <button type="button"
              class="btn btn-sm btn-danger"
              onclick="eliminarImagen(${index})">
        Eliminar
      </button>
    </div>`;
  });
}

window.eliminarImagen = function(index) {
  imagenesExistentes.splice(index, 1);
  renderImagenesActuales();
};

function limpiarFotosYPreviews() {
  imagenesExistentes = [];
  renderImagenesActuales();

  document.querySelectorAll(".grupo").forEach((g) => {
    g.querySelectorAll('input[type="file"]').forEach((inputFile) => {
      inputFile.value = "";
      try {
        inputFile.files = new DataTransfer().files;
      } catch (_) {}
    });

    const preview = g.querySelector(".preview");
    if (preview) preview.innerHTML = "";

    const progBar = g.querySelector(".progress-bar");
    if (progBar) progBar.style.width = "0%";
  });

  actualizarBarra(0);
}

function limpiarTodosLosCamposFormulario() {
  localStorage.removeItem("editandoInforme");
  localStorage.removeItem("editandoInformeCoords");
  localStorage.removeItem(STORAGE_KEY_CAMPOS_NUEVO);
  editandoId = null;

  const form = document.getElementById("form");
  if (form) form.reset();

  const fechaLocal = obtenerFechaHoyLocal();
  const inputFecha = document.querySelector(`[name^="date_"]`);
  if (inputFecha) inputFecha.value = fechaLocal;

  const obsInput = document.querySelector(`[name^="observacion_"]`);
  if (obsInput) obsInput.value = "";

  document.querySelectorAll(`[id^="lat_"], [id^="lon_"]`).forEach((coordInput) => {
    coordInput.value = "";
  });

  limpiarFotosYPreviews();
}

function guardarCamposRegistroNuevo(grupoEl) {
  if (!grupoEl) return;

  const datos = {
    fecha: grupoEl.querySelector(`[name^="date_"]`)?.value || obtenerFechaHoyLocal(),
    empresa: grupoEl.querySelector(`[name^="empresa_"]`)?.value || "",
    ruta: grupoEl.querySelector(`[name^="ruta_"]`)?.value || "",
    subtramo: grupoEl.querySelector(`[name^="subtramo_"]`)?.value || "",
    tarea: grupoEl.querySelector(".tarea-select")?.value || "",
    km: grupoEl.querySelector(`[name^="km_"]`)?.value || "",
    sentido: grupoEl.querySelector(`[name^="sentido_"]`)?.value || "",
    observacion: (grupoEl.querySelector(`[name^="observacion_"]`)?.value || "").toUpperCase(),
    lat: grupoEl.querySelector(`[id^="lat_"]`)?.value || "",
    lon: grupoEl.querySelector(`[id^="lon_"]`)?.value || ""
  };

  localStorage.setItem(STORAGE_KEY_CAMPOS_NUEVO, JSON.stringify(datos));
}

// 🔹 AGREGAR NUEVO GRUPO
let count = 1;
const btnAddGroup = document.getElementById("addGroup");
if (btnAddGroup) {
  btnAddGroup.addEventListener("click", async () => {
    count++;
    const baseGrupo = document.querySelector(".grupo");
    if (!baseGrupo) return;

    const clone = baseGrupo.cloneNode(true);
    clone.setAttribute("data-grupo-id", String(count));

    const heading = clone.querySelector("h5");
    if (heading) heading.innerText = "Tarea " + count;
    clone.querySelectorAll("[name]").forEach((el) => {
      el.name = el.name.replace(/_\d+$/, "_" + count);
      if (el.type !== "file") el.value = "";
    });
    clone.querySelectorAll("[id]").forEach((el) => {
      el.id = el.id.replace(/_\d+$/, "_" + count);
    });

    const preview = clone.querySelector(".preview");
    if (preview) preview.innerHTML = "";
    const progBar = clone.querySelector(".progress-bar");
    if (progBar) progBar.style.width = "0%";

    document.getElementById("grupos").appendChild(clone);
    const totalInput = document.getElementById("total_groups");
    if (totalInput) totalInput.value = count;

    await cargarTareasJerarquicas();
  });
}

// 🔹 BOTÓN LIMPIAR FORMULARIO COMPLETO
const btnClear = document.getElementById("clearForm");
if (btnClear) {
  btnClear.addEventListener("click", () => {
    if (!confirm("¿Querés limpiar todos los campos del formulario?")) return;
    limpiarTodosLosCamposFormulario();
  });
}

// 🔹 GUARDAR FORMULARIO (ÚNICA FUENTE DE VERDAD PARA SUBMIT)
document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  mostrarCarga();
  actualizarBarra(0);

  const idActualEdicion = editandoId || localStorage.getItem("editandoInforme");
  const eraEdicion = Boolean(idActualEdicion);

  try {
    const { data, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !data?.session) {
      alert("Sesión expirada. Volvé a iniciar sesión.");
      ocultarCarga();
      return;
    }

    const user = data.session.user;
    const miOrganizacion = await obtenerOrganizacionUsuario(user.id);

    if (!miOrganizacion) {
      alert("No se pudo identificar la empresa/organización del usuario en la tabla empresas.");
      ocultarCarga();
      return;
    }

    const grupos = document.querySelectorAll(".grupo");
    let totalImagenes = 0;

    grupos.forEach((g) => {
      totalImagenes += g.querySelector(`[name^="photos_"]`)?.files?.length || 0;
    });

    let procesadas = 0;

    for (let i = 0; i < grupos.length; i++) {
      const g = grupos[i];
      const grupoId = g.getAttribute("data-grupo-id") || String(i + 1);

      let imagenes = eraEdicion ? [...imagenesExistentes] : [];
      const inputFotos = g.querySelector(`[name^="photos_"]`);
      const files = Array.from(inputFotos?.files || []);

      for (const file of files) {
        const compressed = await compressImage(file);

        const url = await subirACloudinary(compressed, (progress) => {
          const porcentajeTotal = totalImagenes > 0
            ? Math.round(((procesadas + progress / 100) / totalImagenes) * 100)
            : 100;
          actualizarBarra(porcentajeTotal);
        });

        if (!url) {
          alert("Error subiendo imagen a Cloudinary");
          ocultarCarga();
          return;
        }

        imagenes.push(url);
        procesadas++;

        const porcentaje = totalImagenes > 0
          ? Math.round((procesadas / totalImagenes) * 100)
          : 100;
        actualizarBarra(porcentaje);
      }

      const subtarea = (g.querySelector(".tarea-select")?.value || "").trim().toUpperCase();
      const obsInput = g.querySelector(`[name^="observacion_"]`);
      const observacionMayus = (obsInput?.value || "").toUpperCase();
      if (obsInput) obsInput.value = observacionMayus;

      const latInput = g.querySelector(`#lat_${grupoId}`) || g.querySelector(`[id^="lat_"]`);
      const lonInput = g.querySelector(`#lon_${grupoId}`) || g.querySelector(`[id^="lon_"]`);

      const latParsed = latInput && latInput.value !== "" ? parseFloat(latInput.value) : null;
      const lonParsed = lonInput && lonInput.value !== "" ? parseFloat(lonInput.value) : null;

      const dataToInsert = {
        fecha: g.querySelector(`[name^="date_"]`)?.value || obtenerFechaHoyLocal(),
        empresa: g.querySelector(`[name^="empresa_"]`)?.value || "",
        ruta: g.querySelector(`[name^="ruta_"]`)?.value || "",
        subtramo: g.querySelector(`[name^="subtramo_"]`)?.value || "",
        tarea: subtarea,
        km: (g.querySelector(`[name^="km_"]`)?.value || "").trim(),
        sentido: g.querySelector(`[name^="sentido_"]`)?.value || "",
        observacion: observacionMayus,
        imagenes,
        latitud: latParsed !== null && !Number.isNaN(latParsed) ? latParsed : null,
        longitud: lonParsed !== null && !Number.isNaN(lonParsed) ? lonParsed : null,
        user_id: user.id,
        organizacion_id: miOrganizacion
      };

      if (eraEdicion) {
        const { error } = await supabaseClient
          .from("informes")
          .update(dataToInsert)
          .eq("id", idActualEdicion);

        if (error) {
          console.error("Error al actualizar en Supabase:", error);
          alert("Error al actualizar: " + error.message);
          ocultarCarga();
          return;
        }
      } else {
        const { error } = await supabaseClient
          .from("informes")
          .insert([dataToInsert]);

        if (error) {
          console.error("Error al insertar en Supabase:", error);
          alert("Error al insertar: " + error.message);
          ocultarCarga();
          return;
        }

        if (i === 0) {
          guardarCamposRegistroNuevo(g);
        }
      }
    }

    actualizarBarra(100);

    if (eraEdicion) {
      limpiarTodosLosCamposFormulario();
      ocultarCarga();
      alert("Datos actualizados y guardados correctamente ✅");
    } else {
      limpiarFotosYPreviews();
      ocultarCarga();
      alert("Guardado correctamente ✅");
    }

    window.location.href = "visor.html";
  } catch (err) {
    console.error("Error inesperado al guardar:", err);
    alert("Ocurrió un error inesperado al guardar: " + (err?.message || err));
    ocultarCarga();
  }
});

// 🔹 CARGAR EDICIÓN
async function cargarEdicion() {
  editandoId = localStorage.getItem("editandoInforme");
  if (!editandoId) return;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData?.session) {
    window.location.href = "login.html";
    return;
  }

  const user = sessionData.session.user;
  const miOrganizacion = await obtenerOrganizacionUsuario(user.id);

  let query = supabaseClient
    .from("informes")
    .select("*")
    .eq("id", editandoId);

  if (miOrganizacion) {
    query = query.or(`organizacion_id.eq.${miOrganizacion},user_id.eq.${user.id}`);
  } else {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    console.error("Error cargando registro a editar:", error);
    return;
  }

  const tareaSelect = document.querySelector(`[name=tarea_1]`);
  if (tareaSelect && data.tarea) {
    tareaSelect.value = String(data.tarea).trim().toUpperCase();
  }

  const dateEl = document.querySelector(`[name^="date_"]`);
  const empEl = document.querySelector(`[name^="empresa_"]`);
  const rutaEl = document.querySelector(`[name^="ruta_"]`);
  const subEl = document.querySelector(`[name^="subtramo_"]`);
  const kmEl = document.querySelector(`[name^="km_"]`);
  const senEl = document.querySelector(`[name^="sentido_"]`);
  const obsEl = document.querySelector(`[name^="observacion_"]`);

  if (dateEl) dateEl.value = data.fecha || "";
  if (empEl) empEl.value = data.empresa || "";
  if (rutaEl) rutaEl.value = data.ruta || "";
  if (subEl) subEl.value = data.subtramo || "";
  if (kmEl) {
    kmEl.value = typeof window.formatearKmTresDecimales === "function"
      ? window.formatearKmTresDecimales(data.km || "")
      : (data.km || "");
  }
  if (senEl) senEl.value = data.sentido || "";
  if (obsEl) obsEl.value = (data.observacion || "").toUpperCase();

  let latGuardada = data.latitud;
  let lonGuardada = data.longitud;

  if (latGuardada == null || lonGuardada == null) {
    try {
      const rawCoords = localStorage.getItem("editandoInformeCoords");
      if (rawCoords) {
        const parsedCoords = JSON.parse(rawCoords);
        if (String(parsedCoords.id) === String(editandoId)) {
          if (latGuardada == null && parsedCoords.latitud != null) latGuardada = parsedCoords.latitud;
          if (lonGuardada == null && parsedCoords.longitud != null) lonGuardada = parsedCoords.longitud;
        }
      }
    } catch (e) {
      console.warn("No se pudieron leer coordenadas de respaldo:", e);
    }
  }

  const latInput = document.getElementById("lat_1") || document.querySelector(`[id^="lat_"]`);
  const lonInput = document.getElementById("lon_1") || document.querySelector(`[id^="lon_"]`);

  if (latInput) latInput.value = latGuardada != null ? latGuardada : "";
  if (lonInput) lonInput.value = lonGuardada != null ? lonGuardada : "";

  if (
    latGuardada != null &&
    lonGuardada != null &&
    !Number.isNaN(Number(latGuardada)) &&
    !Number.isNaN(Number(lonGuardada)) &&
    typeof window.posicionarMapaEnEdicion === "function"
  ) {
    window.posicionarMapaEnEdicion(Number(latGuardada), Number(lonGuardada), 1);
  }

  imagenesExistentes = Array.isArray(data.imagenes) ? [...data.imagenes] : [];
  renderImagenesActuales();
}

await cargarTareasJerarquicas();
await cargarEdicion();

// =============================
// 🔥 LOADING OVERLAY
// =============================
function mostrarCarga() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";
}

function ocultarCarga() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}

function actualizarBarra(valor) {
  const barra = document.getElementById("barraCarga");
  if (barra) {
    barra.style.width = valor + "%";
    barra.innerText = valor + "%";
  }
}

});
