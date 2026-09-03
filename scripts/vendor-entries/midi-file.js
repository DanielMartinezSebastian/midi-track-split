import * as m from 'midi-file';
const mod = m.default ?? m;
export const parseMidi = mod.parseMidi;
export const writeMidi = mod.writeMidi;
