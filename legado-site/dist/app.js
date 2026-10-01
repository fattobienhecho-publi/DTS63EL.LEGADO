const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycby3AvY4-ssIdpZfTOs7Vv18anyCUC4jhq8co9pfrnjlb7zePZiSC6vMglecPX1Dopro/exec";
const bondTemplateSrc = "assets/bono-solidario-template.png";
const goalAmount = 30000000;
const maxReceiptSize = 4 * 1024 * 1024;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function endpointReady() {
  return /^https:\/\/script\.google\.com\/macros\/s\//.test(SHEET_ENDPOINT);
}

function money(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 4600);
}

function fileToRecord(file) {
  if (!file) return Promise.resolve(null);
  if (file.size > maxReceiptSize) {
    throw new Error("receipt-too-large");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type || "archivo",
        size: file.size,
        dataUrl: reader.result,
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeForm(form) {
  const formData = new FormData(form);
  const record = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    record[key] = String(value).trim();
  }
  return record;
}

function submitLabel(kind) {
  if (kind === "donaciones") return "Enviar aporte";
  if (kind === "bonos") return "Comprar bono";
  return "Quiero ser aliado";
}

function setupTabs() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((item) => item.classList.toggle("active", item === tab));
      $$(".form-panel").forEach((panel) =>
        panel.classList.toggle("active", panel.id === tab.dataset.tab),
      );
    });
  });
}

function setupForms() {
  $$(".amount-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const field = $("#donacion input[name='valor']");
      if (field) {
        field.value = button.dataset.amount || "";
        field.focus();
      }
    });
  });

  $$("form[data-kind]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const kind = form.dataset.kind;
      const submit = $("button[type='submit']", form);
      submit.disabled = true;
      submit.textContent = "Enviando...";

      try {
        if (!endpointReady()) {
          toast("Falta conectar la página con Google Sheets. Envíame la URL del Apps Script.");
          return;
        }

        const record = normalizeForm(form);
        if (kind === "bonos" && !/^\d{4}$/.test(record.numero || "")) {
          toast("El número del bono debe tener exactamente 4 cifras.");
          return;
        }

        const file = $("input[type='file']", form)?.files?.[0];
        const comprobante = await fileToRecord(file);
        await sendToSheet({ kind, record, comprobante });
        if (kind === "bonos") {
          await showBondPreview(record);
        }
        form.reset();
        toast(kind === "bonos" ? "Registro enviado. Tu bono quedó listo." : "Registro enviado. Gracias por dejar huella.");
        window.setTimeout(loadGoalProgress, 1800);
      } catch (error) {
        const message =
          error.message === "receipt-too-large"
            ? "El comprobante pesa demasiado. Usa una imagen o PDF menor a 4 MB."
            : "No se pudo enviar el registro. Inténtalo de nuevo.";
        toast(message);
      } finally {
        submit.disabled = false;
        submit.textContent = submitLabel(kind);
      }
    });
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fitFont(ctx, text, maxWidth, startSize, family = "Arial") {
  let size = startSize;
  do {
    ctx.font = `800 ${size}px ${family}`;
    size -= 1;
  } while (ctx.measureText(text).width > maxWidth && size > 16);
}

function cleanFilePart(value) {
  return String(value || "bono")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function generateBondImage(record) {
  const template = await loadImage(bondTemplateSrc);
  const canvas = document.createElement("canvas");
  canvas.width = template.naturalWidth || template.width;
  canvas.height = template.naturalHeight || template.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#001b62";
  ctx.textBaseline = "alphabetic";

  const nombre = String(record.nombre || "").trim();
  const cedula = String(record.cedula || "").trim();
  const whatsapp = String(record.whatsapp || "").trim();
  const numero = String(record.numero || "").replace(/[^\d]/g, "").padStart(4, "0").slice(-4);

  fitFont(ctx, nombre, 270, 24);
  ctx.fillText(nombre, 444, 1258);

  fitFont(ctx, cedula, 270, 24);
  ctx.fillText(cedula, 444, 1312);

  fitFont(ctx, whatsapp, 310, 23);
  ctx.fillText(whatsapp, 406, 1356);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e3002c";
  ctx.font = "900 82px Arial";
  ctx.fillText(numero.slice(0, 2), 453, 1460);
  ctx.fillText(numero.slice(2), 628, 1460);
  ctx.textAlign = "start";

  return canvas.toDataURL("image/png");
}

async function showBondPreview(record) {
  const preview = $("#bondPreview");
  const image = $("#bondPreviewImage");
  const download = $("#bondDownload");
  if (!preview || !image || !download) return;

  const dataUrl = await generateBondImage(record);
  image.src = dataUrl;
  download.href = dataUrl;
  download.download = `bono-solidario-${cleanFilePart(record.numero)}-${cleanFilePart(record.nombre)}.png`;
  preview.hidden = false;
  preview.scrollIntoView({ behavior: "smooth", block: "center" });
}

function sendToSheet(payload) {
  return fetch(SHEET_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

function loadSummaryFromSheet() {
  if (!endpointReady()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const callback = `elLegadoSummary${Date.now()}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("summary-timeout"));
    }, 8000);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callback];
      script.remove();
    }

    window[callback] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("summary-error"));
    };
    script.src = `${SHEET_ENDPOINT}?action=summary&callback=${callback}`;
    document.body.appendChild(script);
  });
}

function fallbackProgress() {
  return {
    raised: 0,
    percent: 0,
    remaining: goalAmount,
    donations: 0,
    bonds: 0,
    companies: 0,
  };
}

async function loadGoalProgress() {
  try {
    const progress = await loadSummaryFromSheet();
    updateGoalProgress(progress || fallbackProgress());
  } catch {
    updateGoalProgress(fallbackProgress());
  }
}

function updateGoalProgress(progress) {
  const raised = Number(progress.raised || 0);
  const percent = Math.min(100, Math.round(Number(progress.percent || 0)));
  const remaining = Math.max(Number(progress.remaining ?? goalAmount - raised), 0);
  const fill = $("#goalFill");
  if (!fill) return;

  $("#goalRaised").textContent = money(raised);
  $("#goalRemaining").textContent = remaining ? `Faltan ${money(remaining)}` : "Meta cumplida";
  $("#goalPercent").textContent = `${percent}%`;
  $("#goalDonations").textContent = Number(progress.donations || 0);
  $("#goalBonds").textContent = Number(progress.bonds || 0);
  $("#goalCompanies").textContent = Number(progress.companies || 0);
  requestAnimationFrame(() => {
    fill.style.width = `${percent}%`;
  });
}

setupTabs();
setupForms();
window.elLegadoPreview = { generateBondImage, showBondPreview };
loadGoalProgress();
window.setInterval(loadGoalProgress, 60000);
