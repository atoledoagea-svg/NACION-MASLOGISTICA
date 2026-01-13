import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

// Importar pdfjs-dist - usar la versión legacy para Node.js
import pdfjsModule from 'pdfjs-dist/legacy/build/pdf.js';
const pdfjsLib = pdfjsModule.default || pdfjsModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar worker para pdfjs
try {
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
} catch (e) {
  try {
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
  } catch (e2) {}
}

// Headers tolerantes -> nombre canónico
const HEADER_PATTERNS = {
  '^CANT\\.?$': 'CANT',
  '^P\\s*\\.?\\s*V\\s*\\.?\\s*P\\.?$': 'P.V.P',
  '^ALIC\\.?$': 'ALIC.',
  '^PU\\s*C/?IVA$': 'PU C/IVA',
  '^ESC$': 'Esc',
  '^I\\s*V\\s*A$': 'I V A',
  '^TOTALES?\\s*\\$?$': 'TOTALES $',
};

const CANON_HEADERS = ['CANT', 'P.V.P', 'ALIC.', 'PU C/IVA', 'Esc', 'I V A', 'TOTALES $'];

const HEADER_MARGIN = 6.0;
const Y_TOL = 3.5;

// Reglas de negocio
const SALDO_PREFIXES = ['SALDO ANTERIOR', 'SALDO ANTERIOR *', 'SALDO ANTERIOR C'];

function norm(s) {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}

function compact(s) {
  if (!s) return '';
  return s.replace(/\s/g, '').toUpperCase();
}

function matchHeaderName(txt) {
  const compactTxt = compact(txt);
  for (const [pat, canon] of Object.entries(HEADER_PATTERNS)) {
    const regex = new RegExp(pat, 'i');
    if (regex.test(compactTxt)) {
      return canon;
    }
  }
  return null;
}

function findDate(text) {
  if (!text) return '';
  const m = text.match(/FECHA\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
  return m ? m[1] : '';
}

function findHeadersBounds(words) {
  const hits = {};
  
  for (const w of words) {
    const h = matchHeaderName(w.str);
    if (h) {
      if (!(h in hits) || w.top < hits[h].top) {
        hits[h] = w;
      }
    }
  }
  
  if (Object.keys(hits).length < 5) {
    return [[], null];
  }
  
  const items = Object.entries(hits)
    .map(([name, w]) => {
      const centerX = (w.x0 + w.x1) / 2.0;
      return [name, centerX];
    })
    .sort((a, b) => a[1] - b[1]);
  
  const centers = items.map(([, c]) => c);
  const bounds = [];
  
  for (let i = 0; i < items.length; i++) {
    const [name, c] = items[i];
    let left, right;
    
    if (i === 0) {
      left = c - (centers[i + 1] - c) / 2.0;
    } else {
      left = (centers[i - 1] + c) / 2.0;
    }
    
    if (i === items.length - 1) {
      right = c + (c - centers[i - 1]) / 2.0;
    } else {
      right = (centers[i + 1] - c) / 2.0 + c;
    }
    
    bounds.push([name, left, right]);
  }
  
  const nm = {};
  bounds.forEach(([n, l, r]) => {
    nm[n] = [n, l, r];
  });
  
  const ordered = CANON_HEADERS.filter(h => h in nm).map(h => nm[h]);
  const headerY = Math.min(...Object.values(hits).map(w => w.top)) + HEADER_MARGIN;
  
  return [ordered, headerY];
}

function groupLines(words, yStart, yEnd = null, tol = Y_TOL) {
  const recs = words
    .filter(w => w.top > yStart && (yEnd === null || w.top < yEnd))
    .map(w => [w.top || 0, w.x0 || 0, w]);
  
  recs.sort((a, b) => {
    if (Math.round(a[0] * 10) !== Math.round(b[0] * 10)) {
      return a[0] - b[0];
    }
    return a[1] - b[1];
  });
  
  const lines = [];
  let cur = [];
  let base = null;
  
  for (const [top, x0, w] of recs) {
    if (base === null) base = top;
    
    if (Math.abs(top - base) <= tol) {
      cur.push(w);
    } else {
      cur.sort((a, b) => (a.x0 || 0) - (b.x0 || 0));
      lines.push(cur);
      cur = [w];
      base = top;
    }
  }
  
  if (cur.length > 0) {
    cur.sort((a, b) => (a.x0 || 0) - (b.x0 || 0));
    lines.push(cur);
  }
  
  return lines;
}

function placeIntoColumns(lineWords, bounds) {
  const cells = {};
  CANON_HEADERS.forEach(h => { cells[h] = ''; });
  
  for (const w of lineWords) {
    const xc = (w.x0 + w.x1) / 2.0;
    const txt = w.str;
    
    for (const [name, x0, x1] of bounds) {
      if (x0 <= xc && xc < x1) {
        cells[name] = cells[name] ? (cells[name] + ' ' + txt).trim() : txt;
        break;
      }
    }
  }
  
  Object.keys(cells).forEach(k => {
    cells[k] = norm(cells[k]);
  });
  
  return cells;
}

function looksLikeItem(cells, publicacion) {
  const hasQty = /\d/.test(cells['CANT'] || '');
  const hasAnyPrice = ['P.V.P', 'PU C/IVA', 'TOTALES $', 'ALIC.', 'I V A', 'Esc']
    .some(k => /\d/.test(cells[k] || ''));
  const normalItem = hasQty && hasAnyPrice;
  
  const isSaldo = SALDO_PREFIXES.some(p => (publicacion || '').toUpperCase().startsWith(p));
  const saldoOk = isSaldo && /\d/.test(cells['TOTALES $'] || '');
  
  return normalItem || saldoOk;
}

function detectClient(items, pageHeight) {
  if (!items || items.length === 0) return '';
  
  const topMin = Math.min(...items.map(item => {
    const y0 = item.transform[5] || 0;
    return pageHeight - y0;
  }));
  
  const band = items
    .filter(item => {
      const y0 = item.transform[5] || 0;
      const top = pageHeight - y0;
      const x0 = item.transform[4] || 0;
      return top <= topMin + 160 && x0 <= 300;
    })
    .map(item => item.str || '')
    .join(' ');
  
  const textBand = norm(band);
  const m = textBand.match(/\b\d+\s*-\s*([A-ZÁÉÍÓÚÜÑ0-9][A-ZÁÉÍÓÚÜÑ0-9\.\-&/ ]+)/i);
  if (m) return norm(m[1]);
  
  return '';
}

function sanitizeSheetName(name) {
  if (!name) return 'SIN_NOMBRE';
  name = name.replace(/[:\\/\?\*\[\]]/g, '_');
  return name.substring(0, 31);
}

function parseMonto(s) {
  if (!s) return null;
  
  let txt = s.trim();
  let neg = false;
  
  if (txt.startsWith('(') && txt.endsWith(')')) {
    neg = true;
    txt = txt.substring(1, txt.length - 1).trim();
  }
  
  txt = txt.replace(/[^\d,.\-]/g, '');
  
  if (txt.startsWith('-')) {
    neg = true;
    txt = txt.substring(1).trim();
  }
  
  if (txt.includes(',') && txt.includes('.')) {
    txt = txt.replace(/\./g, '').replace(',', '.');
  } else if (txt.includes(',') && !txt.includes('.')) {
    if (/,\d{1,2}$/.test(txt)) {
      txt = txt.replace(',', '.');
    } else {
      txt = txt.replace(',', '');
    }
  }
  
  try {
    const val = parseFloat(txt);
    return neg ? -Math.abs(val) : val;
  } catch {
    return null;
  }
}

function canonicalizeTitle(t) {
  const u = (t || '').toUpperCase();
  if (u.startsWith('CARGAS DEL DIA')) return 'CARGAS DEL DIA';
  if (u.startsWith('CARGAS EXTRA')) return 'CARGAS EXTRAS';
  if (u.startsWith('DEVOLUCIONES DEL DIA')) return 'DEVOLUCIONES DEL DIA';
  if (u.startsWith('DEVOLUCIONES EXTRA')) return 'DEVOLUCIONES EXTRAS';
  return u;
}

function addTitleRow(rows, cliente, titulo) {
  rows.push({
    cliente: cliente || 'SIN_NOMBRE',
    archivo: '',
    fecha: '',
    publicacion: titulo,
    cant: '',
    pvp: '',
    alic: '',
    pu_c_iva: '',
    esc: '',
    iva: '',
    totales: '',
    total_positivo: null,
    total_negativo: null,
  });
}

async function extractPage(page, archivo, pageHeight) {
  const rows = [];
  const textContent = await page.getTextContent();
  const text = textContent.items.map(item => item.str).join(' ');
  
  const fecha = findDate(text);
  const cliente = detectClient(textContent.items, pageHeight);
  
  const words = textContent.items
    .filter(item => item.str && item.str.trim().length > 0)
    .map(item => {
      const x0 = item.transform[4] || 0;
      const y0 = item.transform[5] || 0;
      const width = item.width || 0;
      const height = item.height || 0;
      const top = pageHeight - y0;
      
      return {
        str: item.str,
        x0: x0,
        x1: x0 + width,
        top: top,
        width: width,
        height: height,
      };
    });
  
  const [bounds, headerY] = findHeadersBounds(words);
  if (!bounds || bounds.length === 0 || headerY === null) {
    return rows;
  }
  
  let cantX0 = null;
  for (const [name, x0, x1] of bounds) {
    if (name === 'CANT') {
      cantX0 = x0;
      break;
    }
  }
  
  const emittedTitles = new Set();
  let lastDevolTitle = null;
  
  for (const line of groupLines(words, headerY)) {
    let publicacion = '';
    
    if (cantX0 !== null) {
      const left = line.filter(w => ((w.x0 + w.x1) / 2.0) < cantX0 - 1);
      left.sort((a, b) => (a.x0 || 0) - (b.x0 || 0));
      publicacion = norm(left.map(w => w.str).join(' '));
    }
    
    const cells = placeIntoColumns(line, bounds);
    const upub = (publicacion || '').toUpperCase();
    
    // Título real
    if (/^(CARGAS DEL DIA|CARGAS EXTRA|CARGAS EXTRAS|DEVOLUCIONES DEL DIA|DEVOLUCIONES EXTRA|DEVOLUCIONES EXTRAS)/.test(upub)) {
      const canon = canonicalizeTitle(upub);
      if (canon.startsWith('DEVOLUCIONES')) {
        lastDevolTitle = canon;
      }
      if (!emittedTitles.has(canon)) {
        addTitleRow(rows, cliente, canon);
        emittedTitles.add(canon);
      }
      continue;
    }
    
    // Título forzado por prefijo
    const mPref = upub.match(/^(CD|AJ|DD)\b/);
    if (mPref) {
      const pref = mPref[1];
      if (pref === 'CD' && !emittedTitles.has('CARGAS DEL DIA')) {
        addTitleRow(rows, cliente, 'CARGAS DEL DIA');
        emittedTitles.add('CARGAS DEL DIA');
      } else if (pref === 'AJ' && !emittedTitles.has('CARGAS EXTRAS')) {
        addTitleRow(rows, cliente, 'CARGAS EXTRAS');
        emittedTitles.add('CARGAS EXTRAS');
      } else if (pref === 'DD' && lastDevolTitle && !emittedTitles.has(lastDevolTitle)) {
        addTitleRow(rows, cliente, lastDevolTitle);
        emittedTitles.add(lastDevolTitle);
      }
    }
    
    if (!looksLikeItem(cells, publicacion)) {
      continue;
    }
    
    const totStr = cells['TOTALES $'] || '';
    const totVal = parseMonto(totStr);
    const totalPositivo = totVal !== null && totVal > 0 ? totVal : null;
    const totalNegativo = totVal !== null && totVal < 0 ? totVal : null;
    
    rows.push({
      cliente: cliente || 'SIN_NOMBRE',
      archivo: archivo,
      fecha: fecha,
      publicacion: publicacion,
      cant: cells['CANT'] || '',
      pvp: cells['P.V.P'] || '',
      alic: cells['ALIC.'] || '',
      pu_c_iva: cells['PU C/IVA'] || '',
      esc: cells['Esc'] || '',
      iva: cells['I V A'] || '',
      totales: totStr,
      total_positivo: totalPositivo,
      total_negativo: totalNegativo,
    });
  }
  
  return rows;
}

async function processPdf(pdfPath) {
  const rows = [];
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  
  const loadingTask = pdfjsLib.getDocument({
    data: data,
    useWorkerFetch: false,
    verbosity: 0,
  });
  
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    if (error.message && (error.message.includes('worker') || error.message.includes('pdf.worker'))) {
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      }
      const retryTask = pdfjsLib.getDocument({
        data: data,
        useWorkerFetch: false,
        verbosity: 0,
      });
      pdf = await retryTask.promise;
    } else {
      throw error;
    }
  }
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    
    const pageRows = await extractPage(page, path.basename(pdfPath), pageHeight);
    rows.push(...pageRows);
  }
  
  return rows;
}

export async function processPdfFiles(pdfPaths) {
  const allRows = [];
  
  for (const pdfPath of pdfPaths) {
    try {
      const rows = await processPdf(pdfPath);
      allRows.push(...rows);
    } catch (error) {
      console.error(`Error procesando ${pdfPath}:`, error);
      throw new Error(`Error al procesar ${path.basename(pdfPath)}: ${error.message}`);
    }
  }
  
  const cols = ['archivo', 'fecha', 'publicacion', 'cant', 'pvp', 'alic', 'pu_c_iva', 'esc', 'iva', 'totales', 'total_positivo', 'total_negativo'];
  
  const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const tempDir = isVercel ? '/tmp' : path.join(__dirname, '../temp');
  const outputPath = path.join(tempDir, `resumen_cargas-${Date.now()}.xlsx`);
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const workbook = new ExcelJS.Workbook();
  
  if (allRows.length === 0) {
    const worksheet = workbook.addWorksheet('SIN_NOMBRE');
    worksheet.columns = cols.map(col => ({ header: col, key: col, width: 15 }));
  } else {
    // Agrupar por cliente
    const clientes = {};
    for (const row of allRows) {
      const cliente = row.cliente || 'SIN_NOMBRE';
      if (!clientes[cliente]) {
        clientes[cliente] = [];
      }
      clientes[cliente].push(row);
    }
    
    for (const [cliente, rowsCliente] of Object.entries(clientes)) {
      const sheetName = sanitizeSheetName(cliente);
      const worksheet = workbook.addWorksheet(sheetName);
      
      worksheet.columns = cols.map(col => ({ header: col, key: col, width: 15 }));
      
      for (const row of rowsCliente) {
        const excelRow = {};
        cols.forEach(col => {
          excelRow[col] = row[col] !== null && row[col] !== undefined ? row[col] : '';
        });
        worksheet.addRow(excelRow);
      }
    }
  }
  
  await workbook.xlsx.writeFile(outputPath);
  
  return outputPath;
}

