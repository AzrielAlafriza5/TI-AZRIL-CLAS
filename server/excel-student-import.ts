import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { db } from './db.ts';
import type { AttendanceStatus, StudentStatus } from '../src/types/index.ts';

export interface ParsedAttendanceWeek {
  week: number;
  label: string;
  raw: string;
  status: AttendanceStatus | null;
}

export interface StudentImportSheetInfo {
  name: string;
  isHes: boolean;
  isOtherProdi: boolean;
  selected: boolean;
  totalRows: number;
  hesRows: number;
  note: string;
}

export interface StudentImportTargetInfo {
  studyProgramId: string | null;
  studyProgramCode: string;
  studyProgramName: string;
  classId: string | null;
  className: string;
  willAutoCreate: boolean;
}

export interface ParsedStudentImportRow {
  rowNumber: number;
  sheetName: string;
  nim: string;
  fullName: string;
  rawProdi: string;
  isHes: boolean;
  targetProgramName: string;
  targetClassName: string;
  detectedColor: 'red' | 'green' | 'neutral';
  detectedColorLabel: 'Merah' | 'Hijau' | 'Netral';
  detectedColorHex: string | null;
  status: StudentStatus;
  statusLabel: 'AFK' | 'Lulus' | 'Aktif';
  actionState: 'new' | 'skipped_duplicate' | 'skipped_non_hes' | 'invalid';
  reason: string;
  attendanceWeeks: ParsedAttendanceWeek[];
  attendanceCount: number;
}

export interface StudentImportPreviewResult {
  fileName: string;
  sheets: StudentImportSheetInfo[];
  targetAssignment: StudentImportTargetInfo;
  hasWeeklyAttendance: boolean;
  rows: ParsedStudentImportRow[];
  summary: {
    totalRows: number;
    newTotal: number;
    newAktif: number;
    newLulus: number;
    newAfk: number;
    skippedDuplicate: number;
    skippedNonHes: number;
    invalid: number;
  };
}

// Standard Office 2013+ fallback theme palette (indices 0..9: lt1, dk1, lt2, dk2, accent1..6)
const DEFAULT_THEME_HEX: string[] = [
  'FFFFFF', // 0: lt1
  '000000', // 1: dk1
  'E7E6E6', // 2: lt2
  '44546A', // 3: dk2
  '4472C4', // 4: accent1
  'ED7D31', // 5: accent2
  'A5A5A5', // 6: accent3
  'FFC000', // 7: accent4
  '5B9BD5', // 8: accent5
  '70AD47', // 9: accent6
];

// Standard Excel BIFF8 / OOXML indexed color palette (0..63)
const INDEXED_PALETTE: Record<number, string> = {
  0: '000000',
  1: 'FFFFFF',
  2: 'FF0000',
  3: '00FF00',
  4: '0000FF',
  5: 'FFFF00',
  6: 'FF00FF',
  7: '00FFFF',
  8: '000000',
  9: 'FFFFFF',
  10: 'FF0000',
  11: '00FF00',
  12: '0000FF',
  13: 'FFFF00',
  14: 'FF00FF',
  15: '00FFFF',
  16: '800000',
  17: '008000',
  18: '000080',
  19: '808000',
  20: '800080',
  21: '008080',
  22: 'C0C0C0',
  23: '808080',
  24: '9999FF',
  25: '993366',
  26: 'FFFFCC',
  27: 'CCFFFF',
  28: '660066',
  29: 'FF8080',
  30: '0066CC',
  31: 'CCCCFF',
  32: '000080',
  33: 'FF00FF',
  34: 'FFFF00',
  35: '00FFFF',
  36: '800080',
  37: '800000',
  38: '008080',
  39: '0000FF',
  40: '00CCFF',
  41: 'CCFFFF',
  42: 'CCFFCC',
  43: 'FFFF99',
  44: '99CCFF',
  45: 'FF99CC',
  46: 'CC99FF',
  47: 'FFCC99',
  48: '3366FF',
  49: '33CCCC',
  50: '99CC00',
  51: 'FFCC00',
  52: 'FF9900',
  53: 'FF6600',
  54: '666699',
  55: '969696',
  56: '003366',
  57: '339966',
  58: '003300',
  59: '333300',
  60: '993300',
  61: '993366',
  62: '333399',
  63: '333333',
};

function parseThemePaletteFromXml(themeXml?: string): string[] {
  const palette = [...DEFAULT_THEME_HEX];
  if (!themeXml || typeof themeXml !== 'string') return palette;

  const tagOrder = [
    'lt1',
    'dk1',
    'lt2',
    'dk2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
  ];

  tagOrder.forEach((tag, idx) => {
    const regex = new RegExp(
      `<a:${tag}[^>]*>\\s*(?:<a:srgbClr\\s+val="([0-9A-Fa-f]{6})"|<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})")`,
      'i'
    );
    const m = themeXml.match(regex);
    const hex = m?.[1] || m?.[2];
    if (hex) {
      palette[idx] = hex.toUpperCase();
    }
  });

  return palette;
}

function applyTint(rgbHex: string, tint?: number): string {
  if (!tint || Math.abs(tint) < 0.001) return rgbHex;
  const r0 = parseInt(rgbHex.slice(0, 2), 16);
  const g0 = parseInt(rgbHex.slice(2, 4), 16);
  const b0 = parseInt(rgbHex.slice(4, 6), 16);

  const adjust = (c: number) => {
    const val = tint > 0 ? c + (255 - c) * tint : c * (1 + tint);
    return Math.max(0, Math.min(255, Math.round(val)));
  };

  return [adjust(r0), adjust(g0), adjust(b0)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function resolveColorObjToHex(
  colorObj: { argb?: string; rgb?: string; theme?: number; tint?: number; indexed?: number } | undefined,
  themePalette: string[]
): string | null {
  if (!colorObj) return null;

  const rawRgb = colorObj.argb || colorObj.rgb;
  if (typeof rawRgb === 'string' && rawRgb.trim()) {
    const clean = rawRgb.trim().replace(/^#/, '').toUpperCase();
    if (clean.length === 8) {
      // Alpha = 00 means transparent / no fill
      if (clean.startsWith('00')) return null;
      return `#${clean.slice(2)}`;
    }
    if (clean.length === 6) {
      return `#${clean}`;
    }
  }

  if (typeof colorObj.theme === 'number' && colorObj.theme >= 0 && colorObj.theme < themePalette.length) {
    const baseHex = themePalette[colorObj.theme];
    const tinted = applyTint(baseHex, colorObj.tint);
    return `#${tinted}`;
  }

  if (typeof colorObj.indexed === 'number') {
    if (colorObj.indexed === 64 || colorObj.indexed === 65) return null; // system automatic
    const hex = INDEXED_PALETTE[colorObj.indexed];
    if (hex) return `#${hex}`;
  }

  return null;
}

function resolveExcelJsFillToHex(fill: ExcelJS.Fill | undefined, themePalette: string[]): string | null {
  if (!fill) return null;
  if (fill.type === 'pattern') {
    if (!fill.pattern || fill.pattern === 'none') return null;
    const fg = resolveColorObjToHex(fill.fgColor as any, themePalette);
    if (fg) return fg;
    return resolveColorObjToHex(fill.bgColor as any, themePalette);
  }
  if (fill.type === 'gradient' && Array.isArray(fill.stops) && fill.stops.length > 0) {
    return resolveColorObjToHex(fill.stops[0].color as any, themePalette);
  }
  return null;
}

function classifyHexColor(hex: string | null): {
  detectedColor: 'red' | 'green' | 'neutral';
  detectedColorLabel: 'Merah' | 'Hijau' | 'Netral';
  status: StudentStatus;
  statusLabel: 'AFK' | 'Lulus' | 'Aktif';
} {
  if (!hex) {
    return {
      detectedColor: 'neutral',
      detectedColorLabel: 'Netral',
      status: 'netral',
      statusLabel: 'Aktif',
    };
  }

  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    return {
      detectedColor: 'neutral',
      detectedColorLabel: 'Netral',
      status: 'netral',
      statusLabel: 'Aktif',
    };
  }

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  // Near-white or near-black or low-chroma gray -> neutral (Aktif)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if ((r > 238 && g > 238 && b > 238) || (r < 25 && g < 25 && b < 25) || diff < 22) {
    return {
      detectedColor: 'neutral',
      detectedColorLabel: 'Netral',
      status: 'netral',
      statusLabel: 'Aktif',
    };
  }

  // Compute Hue (0..360) and Saturation
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const maxN = Math.max(rn, gn, bn);
  const minN = Math.min(rn, gn, bn);
  const d = maxN - minN;
  const l = (maxN + minN) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  let h = 0;
  if (d !== 0) {
    if (maxN === rn) h = ((gn - bn) / d) % 6;
    else if (maxN === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  // Red band: includes solid #FF0000, dark #C00000, light red/salmon #FFC7CE / #EA9999 / #F4CCCC
  if (((h >= 0 && h <= 22) || h >= 330) && s >= 0.2 && r >= g + 20 && r >= b + 20) {
    return {
      detectedColor: 'red',
      detectedColorLabel: 'Merah',
      status: 'merah',
      statusLabel: 'AFK',
    };
  }

  // Green band: includes solid #00FF00, #00B050, #70AD47, #92D050, light green #C6EFCE / #D9EAD3 / #B5D45D
  if (h >= 72 && h <= 165 && s >= 0.18 && g >= r + 10 && g >= b + 8) {
    return {
      detectedColor: 'green',
      detectedColorLabel: 'Hijau',
      status: 'hijau',
      statusLabel: 'Lulus',
    };
  }

  return {
    detectedColor: 'neutral',
    detectedColorLabel: 'Netral',
    status: 'netral',
    statusLabel: 'Aktif',
  };
}

function extractExcelJsCellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const v = cell.value as any;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(v).trim();
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) {
      return v.richText.map((part: any) => String(part?.text ?? '')).join('').trim();
    }
    if ('result' in v && v.result !== undefined && v.result !== null) {
      return String(v.result).trim();
    }
    if ('text' in v && v.text !== undefined) {
      return String(v.text).trim();
    }
  }
  return String(cell.text ?? '').trim();
}

function normalizeNameForCompare(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeNimString(raw: string): string {
  let clean = raw.trim().replace(/\s+/g, '');
  if (/^\d+\.0+$/.test(clean)) {
    clean = clean.replace(/\.0+$/, '');
  }
  return clean;
}

function normalizeWeeklyAttendanceValue(raw: string): AttendanceStatus | null {
  const v = raw.trim().toLowerCase();
  if (!v || v === '-' || v === '—' || v === '0') return null;
  if (['h', 'hadir', 'present', 'masuk', '✓', '✔', 'v', '1', 'ok', 'y', 'ya'].includes(v)) {
    return 'hadir';
  }
  if (['i', 'izin', 'ijin', 'permit', 'excused'].includes(v)) {
    return 'izin';
  }
  if (['s', 'sakit', 'sick'].includes(v)) {
    return 'sakit';
  }
  if (['a', 'alpha', 'alpa', 'absent', 'absen', 'tidak hadir', 'x'].includes(v)) {
    return 'alpha';
  }
  return null;
}

function detectWeekNumberFromHeader(headerText: string, parentHeaderText = ''): number | null {
  const combined = `${parentHeaderText} ${headerText}`.trim().toLowerCase();
  const h = headerText.trim().toLowerCase();

  // Direct patterns: "Minggu ke-1", "Minggu 1", "Pertemuan 1", "M1", "M-1", "P1", "W1"
  const mExplicit = h.match(/^(?:minggu\s*(?:ke)?[-\s]*|pertemuan\s*(?:ke)?[-\s]*|m[-\s]*|p[-\s]*|w[-\s]*)(\d{1,2})$/i);
  if (mExplicit) {
    const num = Number(mExplicit[1]);
    if (num >= 1 && num <= 9) return num;
  }

  const mInside = h.match(/(?:minggu|pertemuan)\s*(?:ke)?[-\s:]*(\d{1,2})/i);
  if (mInside) {
    const num = Number(mInside[1]);
    if (num >= 1 && num <= 9) return num;
  }

  // Sub-header numeric 1..9 when parent header mentions Minggu / Pertemuan / Absensi / Kehadiran
  if (/^\d$/.test(h) && /(minggu|pertemuan|absen|hadir|kehadiran)/.test(combined)) {
    const num = Number(h);
    if (num >= 1 && num <= 9) return num;
  }

  return null;
}

function classifySheetAsHes(
  sheetName: string,
  bannerText: string
): { isHes: boolean; isOtherProdi: boolean; reason: string } {
  const s = sheetName.trim().toLowerCase();
  const b = bannerText.toLowerCase();

  if (/\bhes\b|hes[\s\-_]*\d|hukum\s+ekonomi\s+syariah/.test(s)) {
    return { isHes: true, isOtherProdi: false, reason: 'Sheet Program Studi HES' };
  }
  if (/pjkr|farmasi|pgsd|pgmi|pai|kpi|mpi|bk|pbsi|akuntansi|manajemen|informatika/.test(s)) {
    return { isHes: false, isOtherProdi: true, reason: 'Sheet prodi lain (bukan HES)' };
  }
  if (/\bhes\b|hukum\s+ekonomi\s+syariah/.test(b)) {
    return { isHes: true, isOtherProdi: false, reason: 'Terdeteksi Prodi HES pada judul sheet' };
  }
  if (/pjkr|farmasi/.test(b)) {
    return { isHes: false, isOtherProdi: true, reason: 'Terdeteksi prodi lain pada judul sheet (bukan HES)' };
  }
  return { isHes: false, isOtherProdi: false, reason: 'Sheet belum terlabeli HES' };
}

function getHesNimPrefixes(): Set<string> {
  const rows = db
    .prepare(`
      SELECT s.nim, UPPER(sp.code) AS code
      FROM students s
      JOIN study_programs sp ON sp.id = s.study_program_id
    `)
    .all() as Array<{ nim: string; code: string }>;

  const hesPrefixes = new Set<string>();
  const otherPrefixes = new Set<string>();
  for (const r of rows) {
    const clean = normalizeNimString(r.nim);
    if (clean.length < 4) continue;
    const prefix = clean.slice(0, 4).toLowerCase();
    if (r.code === 'HES') hesPrefixes.add(prefix);
    else otherPrefixes.add(prefix);
  }
  for (const op of otherPrefixes) {
    hesPrefixes.delete(op);
  }
  return hesPrefixes;
}

export function resolveHesTargetAssignment(preferredSheetName?: string): StudentImportTargetInfo {
  const hesProgram = db
    .prepare(`
      SELECT id, code, name
      FROM study_programs
      WHERE UPPER(code) = 'HES'
         OR UPPER(name) LIKE '%HES%'
         OR UPPER(name) LIKE '%HUKUM EKONOMI SYARIAH%'
      ORDER BY CASE WHEN UPPER(code) = 'HES' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1
    `)
    .get() as { id: string; code: string; name: string } | undefined;

  if (hesProgram) {
    const singleClass = db
      .prepare(`
        SELECT id, name
        FROM classes
        WHERE study_program_id = ?
        ORDER BY created_at ASC
        LIMIT 1
      `)
      .get(hesProgram.id) as { id: string; name: string } | undefined;

    if (singleClass) {
      return {
        studyProgramId: hesProgram.id,
        studyProgramCode: hesProgram.code,
        studyProgramName: hesProgram.name,
        classId: singleClass.id,
        className: singleClass.name,
        willAutoCreate: false,
      };
    }

    const fallbackClassName =
      preferredSheetName && /hes/i.test(preferredSheetName)
        ? preferredSheetName.trim()
        : 'HES-3B';
    return {
      studyProgramId: hesProgram.id,
      studyProgramCode: hesProgram.code,
      studyProgramName: hesProgram.name,
      classId: null,
      className: fallbackClassName,
      willAutoCreate: true,
    };
  }

  const fallbackClassName =
    preferredSheetName && /hes/i.test(preferredSheetName)
      ? preferredSheetName.trim()
      : 'HES-3B';

  return {
    studyProgramId: null,
    studyProgramCode: 'HES',
    studyProgramName: 'Hukum Ekonomi Syariah (HES)',
    classId: null,
    className: fallbackClassName,
    willAutoCreate: true,
  };
}

export async function parseStudentExcelBuffer(
  buffer: Buffer,
  fileName: string,
  options?: { selectedSheets?: string[] }
): Promise<StudentImportPreviewResult> {
  const existingStudents = db
    .prepare(`SELECT id, nim, full_name FROM students`)
    .all() as Array<{ id: string; nim: string; full_name: string }>;

  const existingByNim = new Map<string, { id: string; nim: string; full_name: string }>();
  const existingByName = new Map<string, { id: string; nim: string; full_name: string }>();

  for (const st of existingStudents) {
    existingByNim.set(normalizeNimString(st.nim).toLowerCase(), st);
    existingByName.set(normalizeNameForCompare(st.full_name), st);
  }

  const hesNimPrefixes = getHesNimPrefixes();
  const seenInFileNim = new Set<string>();
  const seenInFileName = new Set<string>();

  const isLegacyXls = fileName.toLowerCase().endsWith('.xls');

  const rawParsedSheets: Array<{
    name: string;
    isHesSheet: boolean;
    isOtherProdi: boolean;
    sheetNote: string;
    rows: Array<{
      rowNumber: number;
      nim: string;
      fullName: string;
      rawProdi: string;
      colorHex: string | null;
      attendanceWeeks: ParsedAttendanceWeek[];
    }>;
  }> = [];

  if (!isLegacyXls) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const themeXml = (workbook as any)?._themes?.theme1 as string | undefined;
    const themePalette = parseThemePaletteFromXml(themeXml);

    workbook.eachSheet((ws) => {
      const sheetName = ws.name;
      const maxScanRows = Math.min(25, ws.rowCount || 0);
      const maxCols = Math.min(40, ws.columnCount || 20);

      let bannerText = '';
      for (let r = 1; r <= Math.min(6, maxScanRows); r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= Math.min(12, maxCols); c++) {
          const t = extractExcelJsCellText(row.getCell(c));
          if (t) bannerText += ` ${t}`;
        }
      }

      const sheetCheck = classifySheetAsHes(sheetName, bannerText);

      // Locate header row containing NIM & Nama
      let headerRowIdx = -1;
      let nimCol = -1;
      let nameCol = -1;
      let prodiCol = -1;
      let statusCol = -1;

      for (let r = 1; r <= maxScanRows; r++) {
        const row = ws.getRow(r);
        let foundNim = -1;
        let foundName = -1;
        let foundProdi = -1;
        let foundStatus = -1;

        for (let c = 1; c <= maxCols; c++) {
          const val = extractExcelJsCellText(row.getCell(c)).toLowerCase();
          if (!val) continue;

          if (foundNim === -1 && (val === 'nim' || val === 'n.i.m' || /\bnim\b/.test(val) || val.includes('no induk'))) {
            foundNim = c;
          } else if (
            foundName === -1 &&
            (val === 'nama' || val === 'nama mahasiswa' || val === 'nama lengkap' || /\bnama\b/.test(val))
          ) {
            foundName = c;
          } else if (foundProdi === -1 && (val === 'prodi' || val.includes('program studi') || val === 'jurusan')) {
            foundProdi = c;
          } else if (foundStatus === -1 && (val === 'status' || val === 'keterangan' || val === 'label')) {
            foundStatus = c;
          }
        }

        if (foundNim !== -1 && foundName !== -1) {
          headerRowIdx = r;
          nimCol = foundNim;
          nameCol = foundName;
          prodiCol = foundProdi;
          statusCol = foundStatus;
          break;
        }
      }

      if (headerRowIdx === -1) {
        rawParsedSheets.push({
          name: sheetName,
          isHesSheet: sheetCheck.isHes,
          isOtherProdi: sheetCheck.isOtherProdi,
          sheetNote: `${sheetCheck.reason} · Header kolom NIM & Nama tidak ditemukan`,
          rows: [],
        });
        return;
      }

      // Detect weekly attendance columns (Minggu ke-1 .. Minggu ke-9)
      const weeklyCols: Array<{ week: number; col: number; label: string }> = [];
      const headerRow = ws.getRow(headerRowIdx);
      const prevHeaderRow = headerRowIdx > 1 ? ws.getRow(headerRowIdx - 1) : null;

      for (let c = 1; c <= maxCols; c++) {
        const hText = extractExcelJsCellText(headerRow.getCell(c));
        const pText = prevHeaderRow ? extractExcelJsCellText(prevHeaderRow.getCell(c)) : '';
        const weekNum = detectWeekNumberFromHeader(hText, pText);
        if (weekNum !== null && !weeklyCols.some((w) => w.week === weekNum)) {
          weeklyCols.push({
            week: weekNum,
            col: c,
            label: hText || `Minggu ke-${weekNum}`,
          });
        }
      }
      weeklyCols.sort((a, b) => a.week - b.week);

      const extractedRows: Array<{
        rowNumber: number;
        nim: string;
        fullName: string;
        rawProdi: string;
        colorHex: string | null;
        attendanceWeeks: ParsedAttendanceWeek[];
      }> = [];

      const totalSheetRows = ws.rowCount || 0;
      for (let r = headerRowIdx + 1; r <= totalSheetRows; r++) {
        const row = ws.getRow(r);
        const nimCell = row.getCell(nimCol);
        const nameCell = row.getCell(nameCol);

        const rawNim = extractExcelJsCellText(nimCell);
        const rawName = extractExcelJsCellText(nameCell);
        const nim = normalizeNimString(rawNim);
        const fullName = rawName.trim().replace(/\s+/g, ' ');

        if (!nim && !fullName) continue;
        if (
          /^(jumlah|total|keterangan|catatan|nb|mengetahui|dosen|koordinator)/i.test(nim) ||
          /^(jumlah|total|keterangan|catatan|nb|mengetahui|dosen|koordinator)/i.test(fullName)
        ) {
          continue;
        }
        if (nim.toLowerCase() === 'nim' && fullName.toLowerCase().includes('nama')) {
          continue;
        }

        const rawProdi = prodiCol !== -1 ? extractExcelJsCellText(row.getCell(prodiCol)) : '';

        const candidates: Array<ExcelJS.Fill | undefined> = [
          nimCell.fill,
          nameCell.fill,
          statusCol !== -1 ? row.getCell(statusCol).fill : undefined,
          row.fill,
        ];

        let chosenHex: string | null = null;
        for (const f of candidates) {
          const hex = resolveExcelJsFillToHex(f, themePalette);
          if (!hex) continue;
          const classified = classifyHexColor(hex);
          if (classified.detectedColor !== 'neutral') {
            chosenHex = hex;
            break;
          }
          if (!chosenHex) chosenHex = hex;
        }

        const attendanceWeeks: ParsedAttendanceWeek[] = weeklyCols.map((wc) => {
          const rawAtt = extractExcelJsCellText(row.getCell(wc.col));
          return {
            week: wc.week,
            label: wc.label,
            raw: rawAtt,
            status: normalizeWeeklyAttendanceValue(rawAtt),
          };
        });

        extractedRows.push({
          rowNumber: r,
          nim,
          fullName,
          rawProdi,
          colorHex: chosenHex,
          attendanceWeeks,
        });
      }

      const matchesHesPrefix =
        !sheetCheck.isOtherProdi &&
        hesNimPrefixes.size > 0 &&
        extractedRows.some((r) => r.nim.length >= 4 && hesNimPrefixes.has(r.nim.slice(0, 4).toLowerCase()));

      rawParsedSheets.push({
        name: sheetName,
        isHesSheet: sheetCheck.isHes || matchesHesPrefix,
        isOtherProdi: sheetCheck.isOtherProdi,
        sheetNote: matchesHesPrefix && !sheetCheck.isHes ? 'Terdeteksi prefiks NIM Prodi HES' : sheetCheck.reason,
        rows: extractedRows,
      });
    });
  } else {
    const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      const bannerText = matrix
        .slice(0, 6)
        .flat()
        .map((v) => String(v ?? ''))
        .join(' ');
      const sheetCheck = classifySheetAsHes(sheetName, bannerText);

      let headerRowIdx = -1;
      let nimCol = -1;
      let nameCol = -1;
      let prodiCol = -1;

      for (let r = 0; r < Math.min(25, matrix.length); r++) {
        const row = matrix[r] || [];
        let foundNim = -1;
        let foundName = -1;
        let foundProdi = -1;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] ?? '').trim().toLowerCase();
          if (!val) continue;
          if (foundNim === -1 && (val === 'nim' || /\bnim\b/.test(val))) foundNim = c;
          else if (foundName === -1 && (val === 'nama' || /\bnama\b/.test(val))) foundName = c;
          else if (foundProdi === -1 && (val === 'prodi' || val.includes('program studi'))) foundProdi = c;
        }
        if (foundNim !== -1 && foundName !== -1) {
          headerRowIdx = r;
          nimCol = foundNim;
          nameCol = foundName;
          prodiCol = foundProdi;
          break;
        }
      }

      if (headerRowIdx === -1) {
        rawParsedSheets.push({
          name: sheetName,
          isHesSheet: sheetCheck.isHes,
          isOtherProdi: sheetCheck.isOtherProdi,
          sheetNote: `${sheetCheck.reason} · Header kolom NIM & Nama tidak ditemukan`,
          rows: [],
        });
        continue;
      }

      const weeklyCols: Array<{ week: number; col: number; label: string }> = [];
      const hRow = matrix[headerRowIdx] || [];
      const pRow = headerRowIdx > 0 ? matrix[headerRowIdx - 1] || [] : [];
      for (let c = 0; c < hRow.length; c++) {
        const hText = String(hRow[c] ?? '').trim();
        const pText = String(pRow[c] ?? '').trim();
        const weekNum = detectWeekNumberFromHeader(hText, pText);
        if (weekNum !== null && !weeklyCols.some((w) => w.week === weekNum)) {
          weeklyCols.push({ week: weekNum, col: c, label: hText || `Minggu ke-${weekNum}` });
        }
      }
      weeklyCols.sort((a, b) => a.week - b.week);

      const extractedRows: Array<{
        rowNumber: number;
        nim: string;
        fullName: string;
        rawProdi: string;
        colorHex: string | null;
        attendanceWeeks: ParsedAttendanceWeek[];
      }> = [];

      for (let r = headerRowIdx + 1; r < matrix.length; r++) {
        const row = matrix[r] || [];
        const nim = normalizeNimString(String(row[nimCol] ?? ''));
        const fullName = String(row[nameCol] ?? '').trim().replace(/\s+/g, ' ');
        if (!nim && !fullName) continue;
        if (/^(jumlah|total|keterangan|catatan|nb)/i.test(nim || fullName)) continue;

        const nimAddr = XLSX.utils.encode_cell({ r, c: nimCol });
        const nameAddr = XLSX.utils.encode_cell({ r, c: nameCol });
        const nimCell = sheet[nimAddr] as any;
        const nameCell = sheet[nameAddr] as any;

        const hex1 = resolveColorObjToHex(nimCell?.s?.fgColor || nimCell?.s?.bgColor, DEFAULT_THEME_HEX);
        const hex2 = resolveColorObjToHex(nameCell?.s?.fgColor || nameCell?.s?.bgColor, DEFAULT_THEME_HEX);
        let chosenHex: string | null = null;
        for (const h of [hex1, hex2]) {
          if (!h) continue;
          if (classifyHexColor(h).detectedColor !== 'neutral') {
            chosenHex = h;
            break;
          }
          if (!chosenHex) chosenHex = h;
        }

        const attendanceWeeks: ParsedAttendanceWeek[] = weeklyCols.map((wc) => {
          const rawAtt = String(row[wc.col] ?? '').trim();
          return {
            week: wc.week,
            label: wc.label,
            raw: rawAtt,
            status: normalizeWeeklyAttendanceValue(rawAtt),
          };
        });

        extractedRows.push({
          rowNumber: r + 1,
          nim,
          fullName,
          rawProdi: prodiCol !== -1 ? String(row[prodiCol] ?? '').trim() : '',
          colorHex: chosenHex,
          attendanceWeeks,
        });
      }

      const matchesHesPrefix =
        !sheetCheck.isOtherProdi &&
        hesNimPrefixes.size > 0 &&
        extractedRows.some((r) => r.nim.length >= 4 && hesNimPrefixes.has(r.nim.slice(0, 4).toLowerCase()));

      rawParsedSheets.push({
        name: sheetName,
        isHesSheet: sheetCheck.isHes || matchesHesPrefix,
        isOtherProdi: sheetCheck.isOtherProdi,
        sheetNote: matchesHesPrefix && !sheetCheck.isHes ? 'Terdeteksi prefiks NIM Prodi HES' : sheetCheck.reason,
        rows: extractedRows,
      });
    }
  }

  const selectedSet = options?.selectedSheets ? new Set(options.selectedSheets) : null;
  const preferredHesSheet = rawParsedSheets.find((s) => s.isHesSheet)?.name;
  const targetAssignment = resolveHesTargetAssignment(preferredHesSheet);

  const sheetsInfo: StudentImportSheetInfo[] = [];
  const finalRows: ParsedStudentImportRow[] = [];

  for (const sheet of rawParsedSheets) {
    // Non-HES prodis like PJKR and FARMASI are strictly excluded
    const sheetSelected = sheet.isOtherProdi
      ? false
      : selectedSet
        ? selectedSet.has(sheet.name)
        : sheet.isHesSheet;
    let hesRowsCount = 0;

    for (const r of sheet.rows) {
      const rowExplicitOtherProdi =
        Boolean(r.rawProdi) &&
        !/\bhes\b|hukum\s+ekonomi\s+syariah/i.test(r.rawProdi) &&
        /(pjkr|farmasi|pgsd|ti|si)/i.test(r.rawProdi);

      const rowIsHes = !sheet.isOtherProdi && sheetSelected && !rowExplicitOtherProdi;
      if (rowIsHes) hesRowsCount++;

      const colorInfo = classifyHexColor(r.colorHex);
      const attendanceCount = r.attendanceWeeks.filter((w) => w.status !== null).length;

      let actionState: ParsedStudentImportRow['actionState'] = 'new';
      let reason = 'Baru — Akun mahasiswa akan dibuat';

      if (!rowIsHes) {
        actionState = 'skipped_non_hes';
        reason = sheet.isOtherProdi
          ? `Dilewati — Sheet "${sheet.name}" bukan Program Studi HES`
          : !sheetSelected
            ? `Dilewati — Sheet "${sheet.name}" tidak dipilih pada filter`
            : `Dilewati — Prodi "${r.rawProdi}" bukan HES`;
      } else if (!r.nim || !r.fullName) {
        actionState = 'invalid';
        reason = !r.nim ? 'NIM kosong' : 'Nama lengkap kosong';
      } else {
        const nimKey = r.nim.toLowerCase();
        const nameKey = normalizeNameForCompare(r.fullName);

        const dupDbNim = existingByNim.get(nimKey);
        const dupDbName = existingByName.get(nameKey);

        if (dupDbNim || dupDbName) {
          actionState = 'skipped_duplicate';
          if (dupDbNim && dupDbName) {
            reason = 'Dilewati karena sudah terdaftar (NIM & Nama cocok)';
          } else if (dupDbNim) {
            reason = `Dilewati karena sudah terdaftar (NIM ${dupDbNim.nim})`;
          } else {
            reason = `Dilewati karena sudah terdaftar (Nama "${dupDbName!.full_name}")`;
          }
        } else if (seenInFileNim.has(nimKey) || seenInFileName.has(nameKey)) {
          actionState = 'skipped_duplicate';
          reason = 'Dilewati (duplikat di dalam file Excel)';
        } else {
          seenInFileNim.add(nimKey);
          seenInFileName.add(nameKey);
        }
      }

      finalRows.push({
        rowNumber: r.rowNumber,
        sheetName: sheet.name,
        nim: r.nim,
        fullName: r.fullName,
        rawProdi: r.rawProdi,
        isHes: rowIsHes,
        targetProgramName: targetAssignment.studyProgramCode,
        targetClassName: targetAssignment.className,
        detectedColor: colorInfo.detectedColor,
        detectedColorLabel: colorInfo.detectedColorLabel,
        detectedColorHex: r.colorHex,
        status: colorInfo.status,
        statusLabel: colorInfo.statusLabel,
        actionState,
        reason,
        attendanceWeeks: r.attendanceWeeks,
        attendanceCount,
      });
    }

    sheetsInfo.push({
      name: sheet.name,
      isHes: sheet.isHesSheet,
      isOtherProdi: sheet.isOtherProdi,
      selected: sheetSelected,
      totalRows: sheet.rows.length,
      hesRows: hesRowsCount,
      note: sheet.sheetNote,
    });
  }

  const newRows = finalRows.filter((r) => r.actionState === 'new');
  const hasWeeklyAttendance = finalRows.some((r) => r.attendanceCount > 0);

  return {
    fileName,
    sheets: sheetsInfo,
    targetAssignment,
    hasWeeklyAttendance,
    rows: finalRows,
    summary: {
      totalRows: finalRows.length,
      newTotal: newRows.length,
      newAktif: newRows.filter((r) => r.status === 'netral').length,
      newLulus: newRows.filter((r) => r.status === 'hijau').length,
      newAfk: newRows.filter((r) => r.status === 'merah').length,
      skippedDuplicate: finalRows.filter((r) => r.actionState === 'skipped_duplicate').length,
      skippedNonHes: finalRows.filter((r) => r.actionState === 'skipped_non_hes').length,
      invalid: finalRows.filter((r) => r.actionState === 'invalid').length,
    },
  };
}

export function normalizeStudentNameKey(name: string): string {
  return normalizeNameForCompare(name);
}

export function normalizeStudentNimKey(nim: string): string {
  return normalizeNimString(nim);
}

