import type { PlateFormat } from './vehicle.js';

/** Placa antiga: ABC1234 | Mercosul: ABC1D23 */
const PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/** Remove tudo que não for letra/número e coloca em caixa alta (máx. 7). */
export function normalizePlate(input: string): string {
  return input
    .toUpperCase()
    .normalize('NFD')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}

export function isValidPlate(input: string): boolean {
  return PLATE_REGEX.test(normalizePlate(input));
}

export function getPlateFormat(input: string): PlateFormat {
  const p = normalizePlate(input);
  return /[A-Z]/.test(p.charAt(4)) ? 'mercosul' : 'antiga';
}

/** Formata para exibição: antiga "ABC-1234", Mercosul "BRA2E19". */
export function formatPlate(input: string): string {
  const p = normalizePlate(input);
  if (p.length !== 7) return p;
  return getPlateFormat(p) === 'antiga' ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

/** Máscara progressiva enquanto o usuário digita (3 letras + dígito + letra/dígito + 2 dígitos). */
export function maskPlateInput(input: string): string {
  const raw = normalizePlate(input);
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (i < 3 && /[A-Z]/.test(c)) out += c;
    else if (i === 3 && /[0-9]/.test(c)) out += c;
    else if (i === 4 && /[A-Z0-9]/.test(c)) out += c;
    else if (i > 4 && /[0-9]/.test(c)) out += c;
    else break;
  }
  return out;
}

/** Converte placa antiga em Mercosul (regra oficial: 5º dígito vira letra A-J). */
export function toMercosul(input: string): string {
  const p = normalizePlate(input);
  if (p.length !== 7 || getPlateFormat(p) === 'mercosul') return p;
  const letter = 'ABCDEFGHIJ'[Number(p[4])];
  return p.slice(0, 4) + letter + p.slice(5);
}

export function plateValidationMessage(input: string): string | null {
  const p = normalizePlate(input);
  if (p.length === 0) return 'Digite a placa do veículo.';
  if (p.length < 7) return 'A placa deve ter 7 caracteres.';
  if (!PLATE_REGEX.test(p)) return 'Formato inválido. Use ABC1234 ou ABC1D23.';
  return null;
}
