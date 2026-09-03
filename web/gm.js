// Nombres General MIDI (número de programa 0-127) tal y como los espera smplr.
export const GM_INSTRUMENTS = [
  'acoustic_grand_piano', 'bright_acoustic_piano', 'electric_grand_piano', 'honkytonk_piano',
  'electric_piano_1', 'electric_piano_2', 'harpsichord', 'clavinet',
  'celesta', 'glockenspiel', 'music_box', 'vibraphone',
  'marimba', 'xylophone', 'tubular_bells', 'dulcimer',
  'drawbar_organ', 'percussive_organ', 'rock_organ', 'church_organ',
  'reed_organ', 'accordion', 'harmonica', 'tango_accordion',
  'acoustic_guitar_nylon', 'acoustic_guitar_steel', 'electric_guitar_jazz', 'electric_guitar_clean',
  'electric_guitar_muted', 'overdriven_guitar', 'distortion_guitar', 'guitar_harmonics',
  'acoustic_bass', 'electric_bass_finger', 'electric_bass_pick', 'fretless_bass',
  'slap_bass_1', 'slap_bass_2', 'synth_bass_1', 'synth_bass_2',
  'violin', 'viola', 'cello', 'contrabass',
  'tremolo_strings', 'pizzicato_strings', 'orchestral_harp', 'timpani',
  'string_ensemble_1', 'string_ensemble_2', 'synth_strings_1', 'synth_strings_2',
  'choir_aahs', 'voice_oohs', 'synth_choir', 'orchestra_hit',
  'trumpet', 'trombone', 'tuba', 'muted_trumpet',
  'french_horn', 'brass_section', 'synth_brass_1', 'synth_brass_2',
  'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax',
  'oboe', 'english_horn', 'bassoon', 'clarinet',
  'piccolo', 'flute', 'recorder', 'pan_flute',
  'blown_bottle', 'shakuhachi', 'whistle', 'ocarina',
  'lead_1_square', 'lead_2_sawtooth', 'lead_3_calliope', 'lead_4_chiff',
  'lead_5_charang', 'lead_6_voice', 'lead_7_fifths', 'lead_8_bass__lead',
  'pad_1_new_age', 'pad_2_warm', 'pad_3_polysynth', 'pad_4_choir',
  'pad_5_bowed', 'pad_6_metallic', 'pad_7_halo', 'pad_8_sweep',
  'fx_1_rain', 'fx_2_soundtrack', 'fx_3_crystal', 'fx_4_atmosphere',
  'fx_5_brightness', 'fx_6_goblins', 'fx_7_echoes', 'fx_8_scifi',
  'sitar', 'banjo', 'shamisen', 'koto',
  'kalimba', 'bagpipe', 'fiddle', 'shanai',
  'tinkle_bell', 'agogo', 'steel_drums', 'woodblock',
  'taiko_drum', 'melodic_tom', 'synth_drum', 'reverse_cymbal',
  'guitar_fret_noise', 'breath_noise', 'seashore', 'bird_tweet',
  'telephone_ring', 'helicopter', 'applause', 'gunshot',
];

export function gmInstrument(program) {
  return GM_INSTRUMENTS[program] || 'acoustic_grand_piano';
}

// Nota de percusión General MIDI (canal 10) -> muestra de la caja de ritmos
// TR-808 de smplr (kick, snare, clap, hihat-close, hihat-open, cymbal,
// tom-hi, mid-tom, tom-low, rimshot, cowbell, clave, conga-hi/mid/low, maraca).
const DRUM_MAP = {
  35: 'kick', 36: 'kick', 37: 'rimshot', 38: 'snare', 39: 'clap', 40: 'snare',
  41: 'tom-low', 42: 'hihat-close', 43: 'tom-low', 44: 'hihat-close', 45: 'mid-tom',
  46: 'hihat-open', 47: 'mid-tom', 48: 'tom-hi', 49: 'cymbal', 50: 'tom-hi',
  51: 'cymbal', 52: 'cymbal', 53: 'cymbal', 54: 'maraca', 55: 'cymbal', 56: 'cowbell',
  57: 'cymbal', 58: 'mid-tom', 59: 'cymbal', 60: 'conga-hi', 61: 'conga-low',
  62: 'conga-mid', 63: 'conga-hi', 64: 'conga-low', 65: 'tom-hi', 66: 'tom-low',
  67: 'cowbell', 68: 'cowbell', 69: 'maraca', 70: 'maraca', 75: 'clave',
  76: 'clave', 77: 'clave',
};

export function drumSample(note) {
  return DRUM_MAP[note] || 'kick';
}
