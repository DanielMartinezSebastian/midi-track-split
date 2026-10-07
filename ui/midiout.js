// Envío de notas a un dispositivo MIDI externo mediante la Web MIDI API.
// Un solo dispositivo de salida y un solo canal para todas las notas.

export class MidiOut {
  constructor() {
    this.access = null;
    this.output = null;   // MIDIOutput seleccionado
    this.channel = 0;     // 0-15
    this.onchange = null;  // callback cuando cambia la lista de dispositivos
  }

  get supported() {
    return typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
  }

  get secureContext() {
    return typeof window !== 'undefined' && window.isSecureContext !== false;
  }

  get enabled() {
    return !!this.output;
  }

  async init() {
    if (!this.supported) {
      throw new Error(
        this.secureContext
          ? 'Este navegador no soporta Web MIDI. Usa Chrome, Edge u Opera (en Brave hay que activarlo en brave://settings/content/midi).'
          : 'Web MIDI necesita una conexión segura. Abre la web como http://localhost:4173 (no por IP) o con https.'
      );
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = (e) => {
      if (this.output && this.output.state === 'disconnected') this.select(null);
      if (this.onchange) this.onchange(this.diagnostics(), e);
    };
    // Traza en consola para diagnóstico.
    const d = this.diagnostics();
    console.info('[MIDI] salidas:', d.outputs, ' entradas:', d.inputs);
    return d;
  }

  outputs() {
    if (!this.access) return [];
    return [...this.access.outputs.values()].map((o) => ({
      id: o.id, name: o.name || o.id, manufacturer: o.manufacturer || '', state: o.state,
    }));
  }

  inputs() {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((i) => ({
      id: i.id, name: i.name || i.id, manufacturer: i.manufacturer || '', state: i.state,
    }));
  }

  diagnostics() {
    return { outputs: this.outputs(), inputs: this.inputs() };
  }

  // Compat: la app llamaba a list() esperando [{id,name}]
  list() {
    return this.outputs();
  }

  select(id) {
    this.panic();
    this.output = id && this.access ? this.access.outputs.get(id) || null : null;
  }

  setChannel(ch1to16) {
    this.panic();
    this.channel = Math.max(0, Math.min(15, (ch1to16 | 0) - 1));
  }

  noteOn(note, velocity, time) {
    if (!this.output) return;
    this.output.send([0x90 | this.channel, clamp(note, 0, 127), clamp(velocity, 1, 127)], safeTime(time));
  }

  noteOff(note, time) {
    if (!this.output) return;
    this.output.send([0x80 | this.channel, clamp(note, 0, 127), 0], safeTime(time));
  }

  // Corta todo: vacía la cola y manda all-sound-off / all-notes-off en los 16 canales.
  panic() {
    if (!this.output) return;
    try { this.output.clear && this.output.clear(); } catch {}
    for (let ch = 0; ch < 16; ch++) {
      this.output.send([0xB0 | ch, 120, 0]);
      this.output.send([0xB0 | ch, 123, 0]);
    }
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function safeTime(t) {
  return Number.isFinite(t) ? Math.max(0, t) : 0;
}
