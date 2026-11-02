import PDFDocument from "pdfkit";
import {
  fmt,
  type Columna,
  type GraficaModelo,
  type Modelo,
  type Seccion,
} from "./export";

// PDF A4 para imprimir: portada, «De qué trata», cifras clave, gráfica vectorial
// (pdfkit, en blanco y negro legible), tablas con totales, «Cómo leerlo» y pie
// con paginación. Sólo presenta lo que trae el modelo.
const ML = 40; // margen lateral (pt)
const W = 595.28;
const H = 841.89;
const CW = W - 2 * ML;
const LIMITE = H - 50; // por encima del pie de página
const INK = "#1B1B1B";
const ACC = "#1F4E5A";
const GRID = "#B8C4C9";
const BAND = "#EEF3F4";
const ZEBRA = "#F5F8F9";
const RH = 16; // alto de fila de tabla
const HH = 24; // alto de encabezado (hasta dos líneas)
const PALETA = [ACC, "#7A9AA3", "#C9D6DA", "#3D3D3D", "#9E9E9E", "#E3E8EA"];

export function renderPdf(
  m: Modelo,
  // comprimir:false solo para pruebas: deja el texto legible en el archivo.
  opciones: { comprimir?: boolean } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: ML,
      bufferPages: true,
      compress: opciones.comprimir ?? true,
      info: { Title: m.titulo, Author: "Nexora POS", Creator: "Nexora POS" },
    });
    const trozos: Buffer[] = [];
    doc.on("data", (t: Buffer) => trozos.push(t));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.on("error", reject);
    try {
      dibujar(doc, m);
      const { count } = doc.bufferedPageRange();
      for (let i = 1; i < count; i++) {
        doc.switchToPage(i);
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(INK)
          .text(
            `${m.negocio} · ${m.titulo} · Página ${i + 1} de ${count}`,
            ML,
            H - 32,
            { width: CW, align: "center", lineBreak: false },
          );
      }
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function dibujar(doc: PDFKit.PDFDocument, m: Modelo) {
  let y = ML;
  const alto = (texto: string, ancho: number, size: number, negrita = false) =>
    doc
      .font(negrita ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .heightOfString(texto, { width: ancho });
  const asegura = (h: number) => {
    if (y + h > LIMITE) {
      doc.addPage();
      y = ML;
    }
  };
  const parrafo = (texto: string, size = 10, negrita = false) => {
    const h = alto(texto, CW, size, negrita);
    asegura(h);
    doc
      .font(negrita ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .fillColor(INK)
      .text(texto, ML, y, { width: CW });
    y += h + 6;
  };
  const titulo = (texto: string) => {
    asegura(40);
    y += 8;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(ACC)
      .text(texto, ML, y, { width: CW, lineBreak: false });
    y += 18;
    doc
      .moveTo(ML, y)
      .lineTo(W - ML, y)
      .strokeColor(ACC)
      .lineWidth(0.8)
      .stroke();
    y += 8;
  };

  // Portada
  doc.rect(0, 0, W, 300).fill(ACC);
  doc
    .fillColor("#FFFFFF")
    .font("Helvetica")
    .fontSize(14)
    .text(m.negocio || "Nexora POS", ML, 90, { width: CW });
  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .text(m.titulo, ML, 120, { width: CW });
  doc
    .font("Helvetica")
    .fontSize(12)
    .text(m.periodo, ML, doc.y + 14, { width: CW });
  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(11)
    .text(`Emitido: ${m.emitido}`, ML, 340, { width: CW })
    .text(`Generado por: ${m.generadoPor}`, ML, doc.y + 6, { width: CW })
    .moveDown(1)
    .fontSize(9)
    .text(
      "Documento para imprimir. Las cifras son las mismas de la pantalla. Es de solo lectura: no cambia ningún dato.",
      ML,
      doc.y + 10,
      { width: CW },
    );

  // Página de contenido: qué es y cifras clave
  doc.addPage();
  y = ML;
  titulo("De qué trata este reporte");
  const cuerpo = m.queEs;
  const hq = alto(cuerpo, CW - 20, 11) + 16;
  asegura(hq + 4);
  doc.roundedRect(ML, y, CW, hq, 6).fillAndStroke(BAND, ACC);
  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(11)
    .text(cuerpo, ML + 10, y + 8, { width: CW - 20 });
  y += hq + 10;
  parrafo(m.paraQueSirve, 10);

  if (m.cifras.length) {
    titulo("Cifras clave");
    const n = Math.min(m.cifras.length, 4);
    const ancho = (CW - (n - 1) * 10) / n;
    asegura(56);
    m.cifras.slice(0, n).forEach((c, i) => {
      const x = ML + i * (ancho + 10);
      doc
        .roundedRect(x, y, ancho, 50, 4)
        .strokeColor(GRID)
        .lineWidth(0.8)
        .stroke();
      doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(8)
        .text(c.etiqueta, x + 8, y + 7, {
          width: ancho - 16,
          lineBreak: false,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(fmt(c.valor, c.formato), x + 8, y + 22, {
          width: ancho - 16,
          lineBreak: false,
        });
    });
    y += 58;
    // shortcut: sólo las cuatro primeras cifras caben en la tira; el resto va en la tabla de totales.
  }

  if (m.grafica) {
    titulo("Gráfica");
    asegura(240);
    y += grafico(doc, m.grafica, ML, y, CW);
    y += 8;
  }

  titulo("Cómo leerlo");
  parrafo(m.comoSeLee, 10);

  for (const sec of m.secciones) {
    titulo(sec.titulo);
    seccion(
      doc,
      sec,
      () => y,
      (v) => (y = v),
      asegura,
    );
  }
}

function seccion(
  doc: PDFKit.PDFDocument,
  sec: Seccion,
  getY: () => number,
  setY: (v: number) => void,
  asegura: (h: number) => void,
) {
  const significados = sec.columnas.filter((c) => c.significa);
  if (significados.length) {
    // Qué significa cada columna (con las mismas palabras de la guía).
    const ancho1 = 150;
    const ancho2 = CW - ancho1;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(INK)
      .text("Qué significa cada columna", ML, getY(), {
        width: CW,
        lineBreak: false,
      });
    setY(getY() + 14);
    for (const c of significados) {
      const h =
        Math.max(
          doc
            .font("Helvetica")
            .fontSize(8.5)
            .heightOfString(c.significa!, { width: ancho2 - 8 }),
          RH - 2,
        ) + 6;
      asegura(h);
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(INK)
        .text(c.etiqueta, ML + 4, getY() + 4, {
          width: ancho1 - 8,
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .text(c.significa!, ML + ancho1 + 4, getY() + 4, { width: ancho2 - 8 });
      setY(getY() + h);
    }
    setY(getY() + 8);
  }

  if (!sec.filas.length) {
    asegura(RH + 10);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(INK)
      .text("Sin movimientos en este período.", ML, getY(), { width: CW });
    setY(getY() + RH);
    return;
  }

  const anchos = anchosDe(sec.columnas);
  const cabecera = () => {
    asegura(HH + 20);
    let x = ML;
    doc.rect(ML, getY(), CW, HH).fill("#D9E1E5");
    sec.columnas.forEach((c, i) => {
      doc
        .fillColor(INK)
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text(c.etiqueta, x + 3, getY() + 3, {
          width: anchos[i] - 6,
          height: HH - 4,
          align: c.formato === "texto" ? "left" : "right",
        });
      x += anchos[i];
    });
    setY(getY() + HH);
  };
  const fila = (
    valores: string[],
    negrita: boolean,
    fondo?: string,
    linea?: boolean,
  ) => {
    if (getY() + RH > LIMITE) {
      doc.addPage();
      setY(ML);
      cabecera();
    }
    let x = ML;
    if (fondo) doc.rect(ML, getY(), CW, RH).fill(fondo);
    if (linea)
      doc
        .moveTo(ML, getY())
        .lineTo(W - ML, getY())
        .strokeColor(INK)
        .lineWidth(0.8)
        .stroke();
    sec.columnas.forEach((c, i) => {
      doc
        .fillColor(INK)
        .font(negrita ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7.5)
        .text(valores[i] ?? "", x + 3, getY() + 4, {
          width: anchos[i] - 6,
          height: RH - 4,
          ellipsis: true,
          align: c.formato === "texto" ? "left" : "right",
        });
      x += anchos[i];
    });
    setY(getY() + RH);
  };

  cabecera();
  sec.filas.forEach((f, n) =>
    fila(
      sec.columnas.map((c) =>
        c.formato === "texto"
          ? String(f[c.clave] ?? "")
          : fmt(f[c.clave], c.formato),
      ),
      false,
      n % 2 ? ZEBRA : undefined,
    ),
  );
  if (sec.totales) {
    fila(
      sec.columnas.map((c, i) =>
        i === 0
          ? "Total"
          : c.clave in sec.totales!
            ? fmt(sec.totales![c.clave], c.formato)
            : "",
      ),
      true,
      undefined,
      true,
    );
  }
  setY(getY() + 10);
}

function anchosDe(cols: Columna[]) {
  const numericas = cols.filter((c) => c.formato !== "texto").length;
  const textos = cols.length - numericas;
  const num = Math.max(numericas, 1);
  // Un importe «RD$ 100,000.00» necesita unos 66 pt a 7.5 pt de letra.
  const anchoNum =
    textos === 0 ? CW / num : Math.max(66, Math.min(78, (CW * 0.5) / num));
  const restante = CW - anchoNum * numericas;
  return cols.map((c) =>
    c.formato === "texto" ? restante / Math.max(textos, 1) : anchoNum,
  );
}

// Gráfica vectorial: barras, líneas o pastel, con título, ejes rotulados y leyenda.
function grafico(
  doc: PDFKit.PDFDocument,
  g: GraficaModelo,
  x: number,
  y0: number,
  w: number,
): number {
  const ALTO = 230;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(INK)
    .text(g.titulo, x, y0, { width: w, lineBreak: false });
  if (g.tipo === "pastel") return pastel(doc, g, x, y0 + 22, w) + 22;

  const top = y0 + 26;
  const rotar = g.tipo === "barras" && g.puntos.length > 6;
  const bottom = y0 + ALTO - (rotar ? 85 : 45);
  const left = x + 60;
  const right = x + w - 8;
  const max = Math.max(...g.puntos.map((p) => p.valor), 0);
  const [tope, paso] = escala(max);
  const yDe = (v: number) => bottom - (v / tope) * (bottom - top);

  doc.lineWidth(0.5).strokeColor(GRID);
  for (let k = 0; k <= 4; k++) {
    const yy = yDe(k * paso);
    doc.moveTo(left, yy).lineTo(right, yy).stroke();
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(INK)
      .text(
        (k * paso).toLocaleString("en-US", { maximumFractionDigits: 0 }),
        x,
        yy - 4,
        {
          width: 52,
          align: "right",
          lineBreak: false,
        },
      );
  }
  doc
    .strokeColor(INK)
    .lineWidth(1)
    .moveTo(left, top)
    .lineTo(left, bottom)
    .lineTo(right, bottom)
    .stroke();

  // Rótulo del eje vertical.
  doc.save();
  doc.translate(x + 8, (top + bottom) / 2);
  doc.rotate(-90);
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(INK)
    .text(g.valor, -70, -4, { width: 140, align: "center", lineBreak: false });
  doc.restore();

  const n = Math.max(g.puntos.length, 1);
  const slot = (right - left) / n;
  if (g.tipo === "barras") {
    doc.lineWidth(0.6);
    g.puntos.forEach((p, i) => {
      const by = yDe(p.valor);
      doc
        .rect(left + i * slot + slot * 0.18, by, slot * 0.64, bottom - by)
        .fillAndStroke(ACC, INK);
    });
  } else {
    const pts = g.puntos.map(
      (p, i) => [left + i * slot + slot / 2, yDe(p.valor)] as const,
    );
    if (pts.length) {
      doc.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(([px, py]) => doc.lineTo(px, py));
      doc.strokeColor(ACC).lineWidth(2).stroke();
      pts.forEach(([px, py]) => doc.circle(px, py, 2.6).fill(INK));
    }
  }

  // Etiquetas del eje horizontal: una de cada varias si hay muchas.
  const cada = rotar ? 1 : Math.ceil(n / 12);
  const largo = rotar ? 16 : Math.max(4, Math.floor((slot * cada) / 3.6));
  g.puntos.forEach((p, i) => {
    if (i % cada) return;
    const t =
      p.nombre.length > largo ? p.nombre.slice(0, largo - 1) + "…" : p.nombre;
    if (rotar) {
      doc.save();
      doc.translate(left + i * slot + slot / 2, bottom + 6);
      doc.rotate(45);
      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor(INK)
        .text(t, 0, 0, { lineBreak: false });
      doc.restore();
      return;
    }
    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(INK)
      .text(t, left + i * slot, bottom + 4, {
        width: slot * cada,
        align: "center",
        lineBreak: false,
      });
  });
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(INK)
    .text(g.etiqueta, left, bottom + (rotar ? 58 : 18), {
      width: right - left,
      align: "center",
      lineBreak: false,
    });
  // Leyenda: en barras y líneas hay una serie.
  doc.rect(x + w - 150, y0 + 6, 8, 8).fillAndStroke(ACC, INK);
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(INK)
    .text(g.valor, x + w - 138, y0 + 5, { lineBreak: false });
  return ALTO;
}

function pastel(
  doc: PDFKit.PDFDocument,
  g: GraficaModelo & { tipo: "pastel" },
  x: number,
  y0: number,
  w: number,
): number {
  const total = g.puntos.reduce((t, p) => t + p.valor, 0);
  if (!total) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(INK)
      .text("Sin datos para graficar.", x, y0 + 60, { lineBreak: false });
    return 150;
  }
  const cx = x + 100;
  const cy = y0 + 95;
  const r = 80;
  let ang = -Math.PI / 2;
  g.puntos.forEach((p, i) => {
    const barrido = (p.valor / total) * 2 * Math.PI;
    const pasos = Math.max(2, Math.ceil(barrido / (Math.PI / 60)));
    doc.moveTo(cx, cy);
    for (let k = 0; k <= pasos; k++) {
      const a = ang + (barrido * k) / pasos;
      doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    doc
      .closePath()
      .fillColor(PALETA[i % PALETA.length])
      .strokeColor(INK)
      .lineWidth(0.6)
      .fillAndStroke();
    ang += barrido;
  });
  g.puntos.forEach((p, i) => {
    const yy = y0 + 20 + i * 22;
    doc.rect(x + 220, yy, 10, 10).fillAndStroke(PALETA[i % PALETA.length], INK);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(INK)
      .text(
        `${p.nombre}: ${fmt(p.valor, "moneda")} (${((p.valor / total) * 100).toFixed(1)} %)`,
        x + 238,
        yy + 1,
        { width: w - 238, lineBreak: false },
      );
  });
  return 200;
}

function escala(max: number): [number, number] {
  if (max <= 0) return [4, 1];
  const crudo = max / 4;
  const mag = 10 ** Math.floor(Math.log10(crudo));
  const paso = Math.ceil(crudo / mag) * mag;
  return [paso * 4, paso];
}
