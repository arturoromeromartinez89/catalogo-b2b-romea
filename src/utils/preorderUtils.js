import { calcPrecioGramo } from "../services/pricingService";
import { normalizeText } from "./textNormalizer";

export const buildPreorderItemFromProduct = (product, quantity = 1, lines = [], plataFinaMxn = 0) => {
  const piezas = Math.max(1, Number(quantity || 1));
  const gramosPorPieza = Number(product.pesoPromedio || product.peso_promedio || 0);
  const line = lines.find((lineItem) => normalizeText(lineItem.codigo) === normalizeText(product.linea));
  const priceListLine = line?._priceListLine;
  const price = priceListLine?.integrated_price
    ? { mo_visible: Number(priceListLine.final_labor || 0), integrado: Number(priceListLine.integrated_price || 0) }
    : line && plataFinaMxn
    ? calcPrecioGramo({ mo_base: line.mo_base, plata_fina_mxn: plataFinaMxn })
    : null;
  const labor = Number(price?.mo_visible || product.quoteLaborPerGram || product.manoObra || product.mano_obra || 0);
  const precioGramo = Number(price?.integrado || product.quotePricePerGram || product.precioMinimo || product.precio_minimo || 0);

  return {
    producto_codigo: product.codigo,
    producto_descripcion: product.descripcion,
    producto_metal: product.metal,
    producto_kilataje: product.kilataje,
    producto_linea: product.linea,
    producto_foto_url: product.fotoUrl || product.foto_url || "",
    piezas,
    gramos_por_pieza: gramosPorPieza,
    gramos_total: piezas * gramosPorPieza,
    labor_mxn: labor,
    precio_gramo_mxn: precioGramo,
    subtotal_mxn: piezas * gramosPorPieza * precioGramo,
  };
};
