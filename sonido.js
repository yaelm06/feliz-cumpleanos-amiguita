"use strict";

const ASCENSO_MS = 300;

// Partitura original en ocho compases. Las notas que cruzan el último
// compás vuelven al primero para que la cajita de música suene sin cortes.
function crearMelodia(contexto) {
  const hz = 22050;
  const pulso = .68;
  const compases = [
    [[53, 60], [[.5,69], [1.5,72], [2.5,74]]],
    [[50, 57], [[0,72], [2,69], [3.25,65]]],
    [[46, 53], [[.5,67], [1.5,69], [2.75,72]]],
    [[48, 55], [[0,67], [2.5,64]]],
    [[53, 60], [[.5,69], [1.5,72], [2.5,77]]],
    [[50, 57], [[0,76], [1.5,74], [3,69]]],
    [[46, 53], [[0,70], [1.5,69], [2.75,67]]],
    [[48, 55], [[0,64], [1.5,67], [2.75,65]]]
  ];
  const cancion = contexto.createBuffer(1, Math.round(compases.length * 4 * pulso * hz), hz);
  const mezcla = cancion.getChannelData(0);
  const nota = new Float32Array(Math.ceil(2.6 * hz));
  for (let i = 0; i < nota.length; i++) {
    const t = i / hz;
    const fase = 2 * Math.PI * 440 * t;
    const ataque = 1 - Math.exp(-t * 110);
    const cuerpo = Math.sin(fase) + .24 * Math.sin(2 * fase) + .07 * Math.sin(3 * fase);
    const campana = .21 * Math.sin(3.98 * fase) * Math.exp(-t * 5);
    nota[i] = ataque * Math.exp(-t * 2.9) * (cuerpo + campana);
  }

  function colocar(tiempo, midi, volumen) {
    const paso = 2 ** ((midi - 69) / 12);
    let destino = Math.round(tiempo * pulso * hz) % mezcla.length;
    for (let p = 0; p < nota.length - 1; p += paso) {
      const i = Math.floor(p);
      mezcla[destino] += volumen * (nota[i] + (nota[i + 1] - nota[i]) * (p - i));
      if (++destino === mezcla.length) destino = 0;
    }
  }

  compases.forEach(([acorde, melodia], i) => {
    const inicio = i * 4;
    colocar(inicio, acorde[0], .046);
    colocar(inicio + 1, acorde[1], .033);
    colocar(inicio + 2.5, acorde[1] + 5, .027);
    for (const [pulsoNota, midi] of melodia) {
      colocar(inicio + pulsoNota, midi, .095);
      colocar(inicio + pulsoNota + .23, midi, .014);
    }
  });
  return cancion;
}

// Una sola muestra contiene el silbido ascendente, el golpe y la cola de chispas.
function crearCohete(contexto, tono) {
  const hz = 24000;
  const subida = ASCENSO_MS / 1000;
  const muestra = contexto.createBuffer(1, Math.ceil((subida + 1.05) * hz), hz);
  const datos = muestra.getChannelData(0);
  let ruidoSuave = 0;
  let ruidoGrave = 0;
  for (let i = 0; i < datos.length; i++) {
    const t = i / hz;
    const ruido = Math.random() * 2 - 1;
    ruidoSuave += .22 * (ruido - ruidoSuave);
    ruidoGrave += .055 * (ruidoSuave - ruidoGrave);
    if (t < subida) {
      const envolvente = Math.sin(Math.PI * t / subida);
      const fase = 2 * Math.PI * tono * (510 * t + 970 * t * t);
      datos[i] = envolvente * (.060 * Math.sin(fase) + .13 * ruidoSuave);
    } else {
      const u = t - subida;
      const fase = 2 * Math.PI * tono * (72 * u + 7.8 * (1 - Math.exp(-16 * u)));
      const golpe = .24 * Math.sin(fase) * Math.exp(-9 * u);
      const estallido = (.53 * ruidoSuave + .12 * ruido) * Math.exp(-12 * u);
      datos[i] = Math.min(1, u * 400) * (golpe + estallido + .28 * ruidoGrave * Math.exp(-4.8 * u));
    }
  }
  for (const instante of [.065, .11, .16, .22, .28, .37, .46, .59, .69]) {
    const inicio = Math.round((subida + instante + Math.random() * .024) * hz);
    for (let j = 0; j < hz * .045; j++) {
      const chasquido = (Math.random() * 2 - 1) * Math.exp(-j / (hz * .010));
      datos[inicio + j] += .19 * (1 - instante) * Math.min(1, j / 22) * chasquido;
    }
  }
  return muestra;
}

function crearAmbiente(boton, alEncender) {
  const TipoAudio = window.AudioContext || window.webkitAudioContext;
  let contexto;
  let salida;
  let musica;
  let muestras;
  let tanda;
  let encendido = false;
  let silenciado = false;
  let paginaCerrada = false;

  function pararFuegos(inmediato = false) {
    if (!tanda) return;
    const ahora = contexto.currentTime;
    const fin = inmediato ? ahora : ahora + .04;
    tanda.volumen.gain.setValueAtTime(tanda.volumen.gain.value, ahora);
    tanda.volumen.gain.linearRampToValueAtTime(0, fin);
    for (const fuente of tanda.fuentes) fuente.stop(fin);
    tanda = null;
  }

  function fuegos(grupos) {
    if (!encendido) return;
    pararFuegos();
    const volumen = contexto.createGain();
    volumen.connect(salida);
    const fuentes = new Set();
    tanda = { volumen, fuentes };
    const inicio = contexto.currentTime;
    grupos.forEach((grupo, i) => {
      const fuente = contexto.createBufferSource();
      fuente.buffer = muestras[i % muestras.length];
      const posicion = contexto.createStereoPanner?.();
      if (posicion) {
        posicion.pan.value = grupo.balance * .65;
        fuente.connect(posicion).connect(volumen);
      } else {
        fuente.connect(volumen);
      }
      fuentes.add(fuente);
      fuente.onended = () => {
        fuente.disconnect();
        posicion?.disconnect();
        fuentes.delete(fuente);
        if (fuentes.size === 0) {
          volumen.disconnect();
          if (tanda?.fuentes === fuentes) tanda = null;
        }
      };
      fuente.start(inicio + grupo.demora / 1000);
    });
  }

  function actualizar() {
    const activo = contexto?.state === "running" && !silenciado && !paginaCerrada && !document.hidden;
    boton.setAttribute("aria-pressed", String(!silenciado));
    boton.title = silenciado ? "Activar sonido" : "Silenciar";
    if (salida) salida.gain.value = activo ? 1 : 0;
    if (activo === encendido) return;
    encendido = activo;
    if (!activo) {
      pararFuegos(true);
      return;
    }
    if (!musica) {
      muestras = [crearCohete(contexto, .92), crearCohete(contexto, 1.08)];
      musica = contexto.createBufferSource();
      musica.buffer = crearMelodia(contexto);
      musica.loop = true;
      musica.connect(salida);
      musica.start();
    }
    alEncender();
  }

  function iniciar() {
    if (!TipoAudio || silenciado || paginaCerrada || document.hidden || encendido) return;
    try {
      if (!contexto) {
        contexto = new TipoAudio();
        salida = contexto.createGain();
        salida.gain.value = 0;
        salida.connect(contexto.destination);
        contexto.onstatechange = actualizar;
      }
      if (contexto.state !== "running") contexto.resume().then(actualizar, actualizar);
      actualizar();
    } catch {
      actualizar();
    }
  }

  function pausar() {
    actualizar();
    if (contexto?.state === "running") {
      contexto.suspend().then(() => {
        actualizar();
        if (!silenciado && !paginaCerrada && !document.hidden) iniciar();
      }, actualizar);
    }
  }

  boton.hidden = !TipoAudio;
  boton.addEventListener("click", () => {
    silenciado = !silenciado;
    if (silenciado) pausar();
    else iniciar();
  });
  function iniciarAlInteractuar(evento) {
    if (!boton.contains(evento.target)) iniciar();
  }
  document.addEventListener("pointerup", iniciarAlInteractuar, { capture: true, passive: true });
  document.addEventListener("click", iniciarAlInteractuar, true);
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") iniciarAlInteractuar(evento);
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pausar();
    else iniciar();
  });
  window.addEventListener("pagehide", () => { paginaCerrada = true; pausar(); });
  window.addEventListener("pageshow", () => { paginaCerrada = false; iniciar(); });
  return { iniciar, fuegos, pararFuegos };
}
