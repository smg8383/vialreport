// 🌍 INICIALIZACIÓN GLOBAL DE SUPABASE (Fuera del DOMContentLoaded para estar disponible de inmediato)
const supabaseClient = supabase.createClient(
  "https://yepethuzzretakioqyqy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcGV0aHV6enJldGFraW9xeXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTQwMDcsImV4cCI6MjA5MDUzMDAwN30.1sRjLDe56C7ILa6n3zNHjbC9cl4nAwr-Pkp--uzoXQs"
);
window.supabaseClient = supabaseClient; // Exponer globalmente para el mapa y el GPS del HTML

document.addEventListener("DOMContentLoaded", async () => {

// 🔒 SESSION
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) window.location.href = "login.html";
})();

// 🚪 CERRAR SESIÓN
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    if (!confirm("¿Querés cerrar sesión para ingresar con otra cuenta?")) return;
    await supabaseClient.auth.signOut();
    localStorage.removeItem("editandoInforme");
    window.location.href = "login.html";
  });
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
          reject(null);
        }
      } catch (err) {
        reject(null);
      }
    };

    xhr.onerror = () => reject(null);

    xhr.send(formData);
  });
}

// 🧠 COMPRESIÓN
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => (img.src = e.target.result);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const scale = 1200 / img.width;
      canvas.width = 1200;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })),
        "image/jpeg",
        0.7
      );
    };

    reader.readAsDataURL(file);
  });
}

// 🌐 CARGAR TAREAS DESDE SUPABASE
let tareasCache = [];

function llenarSelectsTareas(data) {
  document.querySelectorAll(".tarea-select").forEach((select) => {
    select.innerHTML = "";

    let currentTarea = "";

    data.forEach((item) => {
      if (item.tarea !== currentTarea) {
        currentTarea = item.tarea;

        const optGroup = document.createElement("optgroup");
        optGroup.label = currentTarea;
        select.appendChild(optGroup);

        const option = document.createElement("option");
        option.value = item.subtarea.toUpperCase();
        option.textContent = item.subtarea.toUpperCase();

        optGroup.appendChild(option);
      } else {
        const optGroup = select.querySelector(
          `optgroup[label="${currentTarea}"]`
        );

        const option = document.createElement("option");
        option.value = item.subtarea.toUpperCase();
        option.textContent = item.subtarea.toUpperCase();

        optGroup.appendChild(option);
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

  tareasCache = data;
  llenarSelectsTareas(data);
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
    const files = Array.from(input.files);

    if (files.length > 4) {
      alert("Máximo 4 imágenes");
      input.value = "";
      return;
    }

    const preview = input.closest(".grupo").querySelector(".preview");
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

// 🔹 AGREGAR NUEVO GRUPO
let count = 1;
const btnAddGroup = document.getElementById("addGroup");
if (addGroup) {
  addGroup.addEventListener("click", async () => {
    count++;
    const clone = document.querySelector(".grupo").cloneNode(true);

    clone.querySelector("h5").innerText = "Tarea " + count;
    clone.querySelectorAll("[name]").forEach((el) => {
      el.name = el.name.replace(/_\d+$/, "_" + count);
      if(el.type !== "file") el.value = "";
    });

    clone.querySelector(".preview").innerHTML = "";
    clone.querySelector(".progress-bar").style.width = "0%";

    document.getElementById("grupos").appendChild(clone);
    document.getElementById("total_groups").value = count;

    await cargarTareasJerarquicas();
  });
}

// 🔹 LIMPIAR FORMULARIO
const btnClear = document.getElementById("clearForm");
if (btnClear) {
  btnClear.addEventListener("click", () => {
    if (!confirm("¿Querés limpiar todos los campos del formulario?")) return;
    localStorage.removeItem("editandoInforme");
    window.location.reload();
  });
}

// 🔹 GUARDAR FORMULARIO
let editandoId = localStorage.getItem("editandoInforme");
let imagenesExistentes = [];

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  mostrarCarga();
  actualizarBarra(0);

  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    alert("Sesión expirada");
    ocultarCarga();
    return;
  }
  const user = data.session.user;

  const grupos = document.querySelectorAll(".grupo");
  let totalImagenes = 0;

  grupos.forEach(g => {
    totalImagenes += g.querySelector(`[name^="photos_"]`).files.length;
  });

  let procesadas = 0;

  try {
    for (let i = 0; i < grupos.length; i++) {
      const g = grupos[i];
      const grupoId = g.getAttribute("data-grupo-id") || (i + 1);

      let imagenes = [...imagenesExistentes];
      const files = g.querySelector(`[name^="photos_"]`).files;

      for (let file of files) {
        const compressed = await compressImage(file);

        const url = await subirACloudinary(compressed, (progress) => {
          const porcentajeTotal = totalImagenes > 0 ? Math.round(
            ((procesadas + progress / 100) / totalImagenes) * 100
          ) : 100;

          actualizarBarra(porcentajeTotal);
        });

        if (!url) {
          alert("Error subiendo imagen a Cloudinary");
          ocultarCarga();
          return;
        }

        imagenes.push(url);
        procesadas++;

        const porcentaje = totalImagenes > 0 ? Math.round(
          (procesadas / totalImagenes) * 100
        ) : 100;

        actualizarBarra(porcentaje);
      }

      const subtarea = g.querySelector(".tarea-select").value;

      // Capturar coordenadas de los inputs ocultos correspondientes a este grupo
      const latInput = g.querySelector(`#lat_${grupoId}`) || g.querySelector(`[id^="lat_"]`);
      const lonInput = g.querySelector(`#lon_${grupoId}`) || g.querySelector(`[id^="lon_"]`);

      const dataToInsert = {
        fecha: g.querySelector(`[name^="date_"]`).value,
        empresa: g.querySelector(`[name^="empresa_"]`).value,
        ruta: g.querySelector(`[name^="ruta_"]`).value,
        subtramo: g.querySelector(`[name^="subtramo_"]`).value,
        tarea: subtarea,
        km: g.querySelector(`[name^="km_"]`).value,
        sentido: g.querySelector(`[name^="sentido_"]`).value,
        observacion: g.querySelector(`[name^="observacion_"]`).value,
        imagenes,
        latitud: latInput && latInput.value ? parseFloat(latInput.value) : null,
        longitud: lonInput && lonInput.value ? parseFloat(lonInput.value) : null,
        user_id: user.id
      };

      if (editandoId) {
        const { error } = await supabaseClient
          .from("informes")
          .update(dataToInsert)
          .eq("id", editandoId);
        if (error) { 
          alert("Error al actualizar: " + error.message); 
          ocultarCarga(); 
          return; 
        }
        localStorage.removeItem("editandoInforme");
      } else {
        const { error } = await supabaseClient
          .from("informes")
          .insert([dataToInsert]);
        if (error) { 
          alert("Error al insertar: " + error.message); 
          ocultarCarga(); 
          return; 
        }
      }
    }

    actualizarBarra(100);
    alert("Guardado correctamente ✅");

    setTimeout(() => {
      ocultarCarga();
      window.location.href = "visor.html";
    }, 800);

  } catch (err) {
    console.error(err);
    alert("Ocurrió un error inesperado al guardar.");
    ocultarCarga();
  }
});

// 🔹 CARGAR EDICIÓN
async function cargarEdicion() {
  if (!editandoId) return;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const user = sessionData.session.user;

  const { data, error } = await supabaseClient
    .from("informes")
    .select("*")
    .eq("id", editandoId)
    .eq("user_id", user.id)
    .single();

  if (error) { console.log(error); return; }

  document.querySelector(`[name=tarea_1]`).value = data.tarea;
  document.querySelector(`[name^="date_"]`).value = data.fecha || "";
  document.querySelector(`[name^="empresa_"]`).value = data.empresa || "";
  document.querySelector(`[name^="ruta_"]`).value = data.ruta || "";
  document.querySelector(`[name^="subtramo_"]`).value = data.subtramo || "";
  document.querySelector(`[name^="km_"]`).value = data.km || "";
  document.querySelector(`[name^="sentido_"]`).value = data.sentido || "";
  document.querySelector(`[name^="observacion_"]`).value = data.observacion || "";

  imagenesExistentes = data.imagenes || [];
  renderImagenesActuales();
}

await cargarTareasJerarquicas();
cargarEdicion();

// 🔹 RENDER + ELIMINAR IMAGENES
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
  const fotosEl = document.querySelector(".fotos");
  if (fotosEl) fotosEl.value = "";
  renderImagenesActuales();
}

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
