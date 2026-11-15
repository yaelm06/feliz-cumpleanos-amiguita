"use strict";

const portada = document.querySelector(".portada");
const carta = document.getElementById("carta");
const abrir = document.getElementById("abrir");
const regalo = document.getElementById("regalo");
const repetir = document.getElementById("repetir");
const volver = document.getElementById("volver");
const cerrar = document.getElementById("cerrar");
const corazonVuelta = document.getElementById("corazon-vuelta");
const saludo = document.getElementById("saludo");
const postal = document.getElementById("postal");
const frases = [...document.querySelectorAll("#frases > li")];
const anterior = document.getElementById("anterior");
const siguiente = document.getElementById("siguiente");
const cuenta = document.getElementById("cuenta");
const anuncio = document.getElementById("anuncio-frase");
const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
const lienzo = document.getElementById("fuegos");
const dibujo = lienzo.getContext("2d");
let fotograma = 0;
let proximaTanda = 0;
let aperturaPendiente = 0;
let cierrePendiente = 0;
let finDelAbrazo = 0;
let fraseActual = 0;
let inicioDeslizamiento = null;
const sonido = crearAmbiente(document.getElementById("sonido"), celebrar);

const colores = [
  ["#ffb0aa", "#ffe3b9", "#e78b9f"],
  ["#ffe19a", "#fff1cf", "#e4af82"],
  ["#d5b7f2", "#f2dafa", "#b5a2e2"],
  ["#a8d4cd", "#e4edd2", "#a4bcd7"]
];

const segmentador = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("es", { granularity: "grapheme" }) : null;

function prepararLetras(palabra, retardo, paso) {
  const texto = palabra.textContent;
  const caracteres = segmentador
    ? Array.from(segmentador.segment(texto), parte => parte.segment)
    : texto.match(/\p{L}\p{M}*|[^\p{L}]+/gu);
  const letras = caracteres.map(caracter => {
    const letra = document.createElement("span");
    letra.className = "letra";
    letra.textContent = caracter;
    letra.style.setProperty("--retardo", retardo + "ms");
    retardo += paso;
    return letra;
  });
  palabra.replaceChildren(...letras);
  return retardo;
}

let retardoSaludo = 120;
for (const palabra of saludo.querySelectorAll(".palabra")) {
  retardoSaludo = prepararLetras(palabra, retardoSaludo, 38);
}

for (const frase of frases) {
  const texto = document.createElement("span");
  texto.className = "texto-frase";
  texto.setAttribute("aria-hidden", "true");
  frase.setAttribute("aria-label", frase.textContent.trim());
  texto.append(...frase.childNodes);
  const lector = document.createTreeWalker(texto, NodeFilter.SHOW_TEXT);
  const nodos = [];
  while (lector.nextNode()) nodos.push(lector.currentNode);
  let retardo = 0;
  for (const nodo of nodos) {
    const partes = nodo.textContent.split(/(\s+)/).map(parte => {
      if (!parte.trim()) return parte;
      const palabra = document.createElement("span");
      palabra.className = "palabra";
      palabra.textContent = parte;
      retardo = prepararLetras(palabra, retardo, 6);
      return palabra;
    });
    nodo.replaceWith(...partes);
  }
  frase.append(texto);
}

function cancelarFuegos() {
  clearTimeout(proximaTanda);
  proximaTanda = 0;
  cancelAnimationFrame(fotograma);
  fotograma = 0;
  sonido.pararFuegos();
  dibujo?.clearRect(0, 0, lienzo.width, lienzo.height);
}

function celebrar() {
  cancelarFuegos();
  if (!dibujo || document.hidden || portada.classList.contains("abierto") || location.hash === "#carta") return;

  const marco = portada.getBoundingClientRect();
  lienzo.width = Math.ceil(marco.width / 2);
  lienzo.height = Math.ceil(marco.height / 2);
  const compacto = marco.width <= 710;
  const puntos = compacto
    ? [[.17,.16], [.81,.18], [.12,.53], [.90,.55], [.53,.13]]
    : [[.56,.24], [.86,.23], [.12,.17], [.92,.57], [.55,.58]];
  const inicio = performance.now();
  const escala = Math.min(1.25, Math.max(.75, marco.width / 1060));
  const sinMovimiento = movimientoReducido.matches;

  const grupos = puntos.map(([x, y], i) => {
    const tono = colores[i % colores.length];
    const rayos = [];
    const giro = Math.random() * .3;
    for (let j = 0; j < 17; j++) {
      const direccion = j / 17 * Math.PI * 2 + giro + (Math.random() - .5) * .10;
      const radio = (24 + Math.random() * 14) * escala;
      rayos.push({ dx: Math.cos(direccion) * radio, dy: Math.sin(direccion) * radio, color: tono[j % 3] });
    }
    return { x: x * lienzo.width, y: y * lienzo.height, balance: x * 2 - 1, demora: i * 440, tono, rayos };
  });
  sonido.fuegos(grupos);

  function pintar(ahora) {
    dibujo.clearRect(0, 0, lienzo.width, lienzo.height);
    const tiempo = ahora - inicio;
    for (const grupo of grupos) {
      const edad = sinMovimiento ? 670 : tiempo - grupo.demora;
      if (edad < 0 || edad > 1780) continue;
      if (edad < ASCENSO_MS) {
        const avance = edad / ASCENSO_MS;
        const y = grupo.y + (1 - avance) * 17 * escala;
        dibujo.globalAlpha = .65;
        dibujo.fillStyle = grupo.tono[1];
        dibujo.fillRect(Math.round(grupo.x), Math.round(y), 1, 3);
        continue;
      }
      const avance = (edad - ASCENSO_MS) / 1480;
      const radio = Math.min(1, 1 - Math.pow(1 - avance, 3));
      const caida = avance * avance * 8 * escala;
      for (const rayo of grupo.rayos) {
        const x = Math.round(grupo.x + rayo.dx * radio);
        const y = Math.round(grupo.y + rayo.dy * radio + caida);
        const cola = radio * (.40 + avance * .42);
        dibujo.globalAlpha = (1 - avance * avance) * .68;
        dibujo.strokeStyle = rayo.color;
        dibujo.beginPath();
        dibujo.moveTo(Math.round(grupo.x + rayo.dx * cola) + .5, Math.round(grupo.y + rayo.dy * cola + caida * .55) + .5);
        dibujo.lineTo(x + .5, y + .5);
        dibujo.stroke();
        dibujo.globalAlpha = 1 - avance * avance;
        dibujo.fillStyle = rayo.color;
        dibujo.fillRect(x, y, 1.5, 1.5);
        dibujo.globalAlpha *= .60;
        dibujo.fillRect(Math.round(grupo.x + rayo.dx * radio * .32), Math.round(grupo.y + rayo.dy * radio * .32 + caida * .4), 1, 1);
      }
      if (avance < .24) {
        dibujo.globalAlpha = .8 - avance * 3;
        dibujo.fillStyle = grupo.tono[1];
        dibujo.fillRect(Math.round(grupo.x)-2, Math.round(grupo.y), 5, 1);
        dibujo.fillRect(Math.round(grupo.x), Math.round(grupo.y)-2, 1, 5);
      }
    }
    dibujo.globalAlpha = 1;
    if (!sinMovimiento && tiempo < 3650) {
      fotograma = requestAnimationFrame(pintar);
    } else if (!sinMovimiento) {
      fotograma = 0;
      proximaTanda = window.setTimeout(celebrar, 600);
    }
  }
  if (sinMovimiento) pintar(inicio);
  else fotograma = requestAnimationFrame(pintar);
}

function mostrarFrase(indice, anunciar = true) {
  if (indice < 0 || indice >= frases.length || cierrePendiente) return;
  const ultima = indice === frases.length - 1;
  postal.style.setProperty("--desde", indice < fraseActual ? "-2px" : "2px");
  fraseActual = indice;
  frases.forEach((frase, i) => frase.setAttribute("aria-hidden", String(i !== indice)));
  cuenta.textContent = (indice + 1) + " / " + frases.length;
  anterior.setAttribute("aria-disabled", String(indice === 0));
  siguiente.title = ultima ? "Cerrar" : "Frase siguiente";
  siguiente.setAttribute("aria-label", siguiente.title);
  siguiente.setAttribute("aria-controls", ultima ? "carta" : "frases");
  carta.classList.toggle("ultima", ultima);
  anuncio.textContent = anunciar ? "Frase " + (indice + 1) + " de " + frases.length + ". " + frases[indice].textContent.trim() : "";
}

function mostrarCarta(abierta) {
  if (abierta && !portada.classList.contains("abierto")) mostrarFrase(0, false);
  carta.hidden = !abierta;
  portada.classList.toggle("abierto", abierta);
  repetir.hidden = abierta || !dibujo;
  cerrar.hidden = !abierta;
  for (const enlace of [abrir, regalo]) {
    enlace.setAttribute("aria-controls", "carta");
    enlace.setAttribute("aria-expanded", String(abierta));
  }
}

function escribirDestino(destino) {
  if (location.hash !== destino) location.hash = destino;
}

function irALaCarta(evento) {
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  const estabaAbierta = !carta.hidden;
  if (aperturaPendiente) return;
  clearTimeout(finDelAbrazo);
  corazonVuelta.hidden = true;
  cancelarFuegos();
  mostrarCarta(true);
  const demora = estabaAbierta || movimientoReducido.matches ? 0 : 860;
  aperturaPendiente = window.setTimeout(() => {
    aperturaPendiente = 0;
    escribirDestino("#carta");
    carta.scrollIntoView({ block: "start" });
    document.getElementById("titulo-carta").focus({ preventScroll: true });
  }, demora);
}

function sincronizarDestino() {
  clearTimeout(aperturaPendiente);
  aperturaPendiente = 0;
  const abierta = location.hash === "#carta";
  if (!abierta) {
    clearTimeout(cierrePendiente);
    cierrePendiente = 0;
    carta.classList.remove("cerrando");
    inicioDeslizamiento = null;
  }
  const veniaDeCarta = portada.classList.contains("abierto");
  mostrarCarta(abierta);
  if (abierta) {
    corazonVuelta.hidden = true;
    cancelarFuegos();
    carta.scrollIntoView({ block: "start" });
  } else if (veniaDeCarta) {
    corazonVuelta.hidden = false;
    clearTimeout(finDelAbrazo);
    finDelAbrazo = window.setTimeout(() => { corazonVuelta.hidden = true; }, 1800);
    celebrar();
  }
}

function cerrarCarta(evento) {
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  if (cierrePendiente) return;
  function volverAlInicio() {
    escribirDestino("#inicio");
    sincronizarDestino();
    portada.scrollIntoView();
    abrir.focus({ preventScroll: true });
  }
  if (location.hash === "#carta" && !movimientoReducido.matches) {
    carta.classList.add("cerrando");
    cierrePendiente = window.setTimeout(volverAlInicio, 250);
  } else {
    volverAlInicio();
  }
}

abrir.addEventListener("click", irALaCarta);
regalo.addEventListener("click", irALaCarta);
volver.addEventListener("click", cerrarCarta);
cerrar.addEventListener("click", cerrarCarta);
anterior.addEventListener("click", () => mostrarFrase(fraseActual - 1));
siguiente.addEventListener("click", (evento) => {
  if (fraseActual === frases.length - 1) cerrarCarta(evento);
  else mostrarFrase(fraseActual + 1);
});
document.addEventListener("keydown", (evento) => {
  if (carta.hidden || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  if (evento.key === "Escape") cerrarCarta(evento);
  if (evento.key === "ArrowLeft" || evento.key === "ArrowRight") {
    evento.preventDefault();
    mostrarFrase(fraseActual + (evento.key === "ArrowRight" ? 1 : -1));
  }
});
postal.addEventListener("pointerdown", (evento) => {
  if (!evento.isPrimary || evento.pointerType === "mouse" || evento.target.closest("button, a")) return;
  inicioDeslizamiento = { id: evento.pointerId, x: evento.clientX, y: evento.clientY };
});
postal.addEventListener("pointercancel", () => { inicioDeslizamiento = null; });
postal.addEventListener("pointerup", (evento) => {
  if (inicioDeslizamiento?.id !== evento.pointerId) return;
  const dx = evento.clientX - inicioDeslizamiento.x;
  const dy = evento.clientY - inicioDeslizamiento.y;
  inicioDeslizamiento = null;
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    mostrarFrase(fraseActual + (dx < 0 ? 1 : -1));
  }
});
window.addEventListener("hashchange", sincronizarDestino);
window.addEventListener("pagehide", cancelarFuegos);
window.addEventListener("pageshow", evento => { if (evento.persisted) celebrar(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelarFuegos();
  else if (location.hash !== "#carta") celebrar();
});
movimientoReducido.addEventListener?.("change", () => { if (location.hash !== "#carta") celebrar(); });
mostrarFrase(0, false);
carta.classList.add("por-frases");
document.getElementById("pasadores").hidden = false;
sincronizarDestino();
if (dibujo) {
  repetir.addEventListener("click", () => {
    for (const animacion of saludo.getAnimations?.({ subtree: true }) || []) {
      if (animacion.animationName === "cascada") {
        animacion.currentTime = 0;
        animacion.play();
      }
    }
    celebrar();
  });
  if (location.hash !== "#carta") celebrar();
}
sonido.iniciar();
