const supabaseClient = supabase.createClient(
  "https://yepethuzzretakioqyqy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcGV0aHV6enJldGFraW9xeXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTQwMDcsImV4cCI6MjA5MDUzMDAwN30.1sRjLDe56C7ILa6n3zNHjbC9cl4nAwr-Pkp--uzoXQs"
);

// 🔒 SESSION
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) window.location.href = "login.html";
})();

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
      const res = JSON.parse(xhr.responseText);
      resolve(res.secure_url);
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

async function cargarTareasJerarquicas() {
  if (tareasCache.length > 0) return tareasCache;

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

  // Llenar todos los selects existentes
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
        const optGroup = select.querySelector(`optgroup[label="${currentTarea}"]`);
        const option = document.createElement("option");
        option.value = item.subtarea.toUpperCase();
        option.textContent = item.subtarea.toUpperCase();
        optGroup.appendChild(option);
      }
    });
  });

  return tareasCache;
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
document.getElementById("addGroup").addEventListener("click", async () => {
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

// 🔹 GUARDAR FORMULARIO
let editandoId = localStorage.getItem("editandoInforme");
let imagenesExistentes = [];

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    alert("Sesión expirada");
    return;
  }
  const user = data.session.user;

  const grupos = document.querySelectorAll(".grupo");

  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];

    let imagenes = [...imagenesExistentes];

    const files = g.querySelector(`[name^="photos_"]`).files;
    for (let file of files) {
      const compressed = await compressImage(file);
      const url = await subirACloudinary(compressed);
      if (!url) { alert("Error subiendo imagen"); return; }
      imagenes.push(url);
    }

    const subtarea = g.querySelector(".tarea-select").value;

    const dataToInsert = {
      fecha: g.querySelector(`[name^="date_"]`).value,
      tramo: g.querySelector(`[name^="tramo_"]`).value,
      ruta: g.querySelector(`[name^="ruta_"]`).value,
      subtramo: g.querySelector(`[name^="subtramo_"]`).value,
      tarea: subtarea,
      km: g.querySelector(`[name^="km_"]`).value,
      sentido: g.querySelector(`[name^="sentido_"]`).value,
      observacion: g.querySelector(`[name^="observacion_"]`).value,
      imagenes,
      user_id: user.id
    };

    if (editandoId) {
      const { error } = await supabaseClient
        .from("informes")
        .update(dataToInsert)
        .eq("id", editandoId);
      if (error) { alert(error.message); return; }
      localStorage.removeItem("editandoInforme");
    } else {
      const { error } = await supabaseClient
        .from("informes")
        .insert([dataToInsert]);
      if (error) { alert(error.message); return; }
    }
  }

  alert("Guardado correctamente ✅");
  window.location.href = "visor.html";
});

// 🔹 CARGAR EDICIÓN
async function cargarEdicion() {
  if (!editandoId) return;

  const { data: sessionData } = await supabaseClient.auth.getSession();
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
  document.querySelector(`[name^="tramo_"]`).value = data.tramo || "";
  document.querySelector(`[name^="ruta_"]`).value = data.ruta || "";
  document.querySelector(`[name^="subtramo_"]`).value = data.subtramo || "";
  document.querySelector(`[name^="km_"]`).value = data.km || "";
  document.querySelector(`[name^="sentido_"]`).value = data.sentido || "";
  document.querySelector(`[name^="observacion_"]`).value = data.observacion || "";

  imagenesExistentes = data.imagenes || [];
  renderImagenesActuales();
}

cargarEdicion();

// 🔹 RENDER + ELIMINAR IMAGENES
function renderImagenesActuales() {
  const cont = document.getElementById("imagenesActuales");
  cont.innerHTML = "";

  imagenesExistentes.forEach((img, index) => {
    cont.innerHTML += `<div class="col-md-3 mb-2 text-center">
      <img src="${img}" class="img-fluid rounded border mb-1">
      <br>
      <button class="btn btn-sm btn-danger" onclick="eliminarImagen(${index})">
        Eliminar
      </button>
    </div>`;
  });
}

function eliminarImagen(index) {
  imagenesExistentes.splice(index, 1);
  renderImagenesActuales();
}

// 🔹 INICIALIZAR TAREAS EN SELECT AL CARGAR
document.addEventListener("DOMContentLoaded", async () => {
  await cargarTareasJerarquicas();
});