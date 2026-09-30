const PASSWORD = "dts63lebrija";
const storeKey = "el-legado-registros";
const emptyStore = { donaciones: [], bonos: [], empresas: [] };
const goalAmount = 30000000;
const bondAmount = 50000;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function getStore() {
  try {
    return { ...emptyStore, ...JSON.parse(localStorage.getItem(storeKey)) };
  } catch {
    return { ...emptyStore };
  }
}

function setStore(data) {
  localStorage.setItem(storeKey, JSON.stringify(data));
}

function parseMoney(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return Number(digits || 0);
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
  window.setTimeout(() => node.classList.remove("show"), 4200);
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function fileToRecord(file) {
  if (!file) return Promise.resolve("");
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
  const record = { fecha: formatDate() };
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    record[key] = String(value).trim();
  }
  return record;
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
      submit.textContent = "Guardando...";
      try {
        const record = normalizeForm(form);
        if (kind === "bonos" && !/^\d{4}$/.test(record.numero || "")) {
          toast("El número del bono debe tener exactamente 4 cifras.");
          return;
        }
        const file = $("input[type='file']", form)?.files?.[0];
        record.comprobante = await fileToRecord(file);
        const data = getStore();
        data[kind].unshift(record);
        setStore(data);
        updateGoalProgress();
        form.reset();
        toast("Registro guardado. Gracias por dejar huella.");
      } catch (error) {
        toast("No se pudo guardar el registro. Inténtalo de nuevo.");
      } finally {
        submit.disabled = false;
        submit.textContent =
          kind === "donaciones" ? "Enviar aporte" : kind === "bonos" ? "Comprar bono" : "Quiero ser aliado";
      }
    });
  });
}

function calculateGoal() {
  const data = getStore();
  const donations = data.donaciones || [];
  const bonds = data.bonos || [];
  const companies = data.empresas || [];
  const donationTotal = donations.reduce((sum, record) => sum + parseMoney(record.valor), 0);
  const bondTotal = bonds.length * bondAmount;
  const raised = donationTotal + bondTotal;
  const percent = Math.min(100, Math.round((raised / goalAmount) * 100));

  return {
    raised,
    percent,
    remaining: Math.max(goalAmount - raised, 0),
    donations: donations.length,
    bonds: bonds.length,
    companies: companies.length,
  };
}

function updateGoalProgress() {
  const progress = calculateGoal();
  const fill = $("#goalFill");
  if (!fill) return;

  $("#goalRaised").textContent = money(progress.raised);
  $("#goalRemaining").textContent = progress.remaining
    ? `Faltan ${money(progress.remaining)}`
    : "Meta cumplida";
  $("#goalPercent").textContent = `${progress.percent}%`;
  $("#goalDonations").textContent = progress.donations;
  $("#goalBonds").textContent = progress.bonds;
  $("#goalCompanies").textContent = progress.companies;
  requestAnimationFrame(() => {
    fill.style.width = `${progress.percent}%`;
  });
}

function setupAdmin() {
  const dialog = $("#adminDialog");
  $("#adminOpen").addEventListener("click", () => dialog.showModal());
  $$("[data-close]").forEach((button) =>
    button.addEventListener("click", () => {
      dialog.close();
      $("#adminPassword").value = "";
    }),
  );
  dialog.addEventListener("close", () => {
    $("#adminLogin").hidden = false;
    $("#adminPanel").hidden = true;
    $("#adminPassword").value = "";
  });
  $("#adminEnter").addEventListener("click", () => {
    if ($("#adminPassword").value !== PASSWORD) {
      toast("Contraseña incorrecta.");
      return;
    }
    $("#adminLogin").hidden = true;
    $("#adminPanel").hidden = false;
    renderAdmin();
  });
  $$("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportCsv(button.dataset.export));
  });
}

function renderAdmin() {
  const data = getStore();
  const target = $("#adminTables");
  target.innerHTML = "";
  [
    ["donaciones", "Donaciones libres"],
    ["bonos", "Bonos solidarios"],
    ["empresas", "Empresas aliadas"],
  ].forEach(([key, title]) => {
    const records = data[key] || [];
    const section = document.createElement("section");
    section.innerHTML = `<h3>${title} (${records.length})</h3>`;
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    wrap.appendChild(buildTable(records));
    section.appendChild(wrap);
    target.appendChild(section);
  });
}

function buildTable(records) {
  const table = document.createElement("table");
  if (!records.length) {
    table.innerHTML = "<tbody><tr><td>No hay registros todavía.</td></tr></tbody>";
    return table;
  }
  const keys = [...new Set(records.flatMap((record) => Object.keys(record)))].filter(
    (key) => key !== "comprobante",
  );
  table.innerHTML = `<thead><tr>${keys.map((key) => `<th>${label(key)}</th>`).join("")}<th>Comprobante</th></tr></thead>`;
  const body = document.createElement("tbody");
  records.forEach((record, index) => {
    const row = document.createElement("tr");
    row.innerHTML = keys.map((key) => `<td>${escapeHtml(record[key] || "")}</td>`).join("");
    const receipt = document.createElement("td");
    if (record.comprobante?.dataUrl) {
      const link = document.createElement("a");
      link.href = record.comprobante.dataUrl;
      link.download = record.comprobante.name || `comprobante-${index + 1}`;
      link.textContent = record.comprobante.name || "Descargar";
      receipt.appendChild(link);
    } else {
      receipt.textContent = "Sin archivo";
    }
    row.appendChild(receipt);
    body.appendChild(row);
  });
  table.appendChild(body);
  return table;
}

function exportCsv(kind) {
  const records = getStore()[kind] || [];
  if (!records.length) {
    toast("No hay registros para exportar.");
    return;
  }
  const keys = [...new Set(records.flatMap((record) => Object.keys(record)))].filter(
    (key) => key !== "comprobante",
  );
  keys.push("comprobante_archivo");
  const rows = [
    keys.map(label),
    ...records.map((record) =>
      keys.map((key) =>
        key === "comprobante_archivo" ? record.comprobante?.name || "" : record[key] || "",
      ),
    ),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `el-legado-${kind}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function label(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Whatsapp", "WhatsApp");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

setupTabs();
setupForms();
setupAdmin();
updateGoalProgress();
window.addEventListener("storage", (event) => {
  if (event.key === storeKey) updateGoalProgress();
});
