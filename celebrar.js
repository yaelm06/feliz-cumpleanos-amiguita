"use strict";

const portada = document.querySelector(".portada");
const carta = document.getElementById("carta");
const abrir = document.getElementById("abrir");
const regalo = document.getElementById("regalo");
const repetir = document.getElementById("repetir");
const volver = document.getElementById("volver");
const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
const lienzo = document.getElementById("fuegos");
const dibujo = lienzo.getContext("2d");
let fotograma = 0;
let aperturaPendiente = 0;

const colores = [
  ["#ffb0aa", "#ffe3b9", "#e78b9f"],
  ["#ffe19a", "#fff1cf", "#e4af82"],
  ["#d5b7f2", "#f2dafa", "#b5a2e2"],
  ["#a8d4cd", "#e4edd2", "#a4bcd7"]
];

function cancelarFuegos() {
  cancelAnimationFrame(fotograma);
  fotograma = 0;
  dibujo?.clearRect(0, 0, lienzo.width, lienzo.height);
}

function celebrar() {
  cancelarFuegos();
  if (!dibujo || document.hidden) return;

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
    return { x: x * lienzo.width, y: y * lienzo.height, demora: i * 440, tono, rayos };
  });

  function pintar(ahora) {
    dibujo.clearRect(0, 0, lienzo.width, lienzo.height);
    const tiempo = ahora - inicio;
    for (const grupo of grupos) {
      const edad = sinMovimiento ? 670 : tiempo - grupo.demora;
      if (edad < 0 || edad > 1780) continue;
      if (edad < 300) {
        const avance = edad / 300;
        const y = grupo.y + (1 - avance) * 17 * escala;
        dibujo.globalAlpha = .65;
        dibujo.fillStyle = grupo.tono[1];
        dibujo.fillRect(Math.round(grupo.x), Math.round(y), 1, 3);
        continue;
      }
      const avance = (edad - 300) / 1480;
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
      cancelarFuegos();
    }
  }
  if (sinMovimiento) pintar(inicio);
  else fotograma = requestAnimationFrame(pintar);
}

function mostrarCarta(abierta) {
  carta.hidden = !abierta;
  portada.classList.toggle("abierto", abierta);
  for (const enlace of [abrir, regalo]) {
    enlace.setAttribute("aria-controls", "carta");
    enlace.setAttribute("aria-expanded", String(abierta));
  }
  abrir.querySelector("span").textContent = abierta ? "Leer la carta" : "Abrir el regalo";
  regalo.setAttribute("aria-label", abierta ? "Leer la carta para Mari" : "Abrir el regalo para Mari");
}

function escribirDestino(destino) {
  if (location.hash !== destino) location.hash = destino;
}

function irALaCarta(evento) {
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  const estabaAbierta = !carta.hidden;
  if (aperturaPendiente) return;
  mostrarCarta(true);
  const demora = estabaAbierta || movimientoReducido.matches ? 0 : 460;
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
  mostrarCarta(abierta);
  if (abierta) carta.scrollIntoView({ block: "start" });
}

abrir.addEventListener("click", irALaCarta);
regalo.addEventListener("click", irALaCarta);
volver.addEventListener("click", (evento) => {
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  escribirDestino("#inicio");
  sincronizarDestino();
  portada.scrollIntoView();
  abrir.focus({ preventScroll: true });
});
window.addEventListener("hashchange", sincronizarDestino);
window.addEventListener("pagehide", cancelarFuegos);
document.addEventListener("visibilitychange", () => { if (document.hidden) cancelarFuegos(); });
movimientoReducido.addEventListener?.("change", () => { if (location.hash !== "#carta") celebrar(); });
sincronizarDestino();
if (dibujo) {
  repetir.hidden = false;
  repetir.addEventListener("click", celebrar);
  if (location.hash !== "#carta") celebrar();
}
