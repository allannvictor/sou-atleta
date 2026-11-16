/** Datas de calendário `YYYY-MM-DD`, sempre tratadas em UTC para não dependerem do fuso da máquina. */

const MS_POR_DIA = 86_400_000;
const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

export function ehData(texto: string): boolean {
  if (!FORMATO.test(texto)) return false;
  const ms = Date.parse(`${texto}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === texto;
}

export function somarDias(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Quantos dias de calendário vão de `de` até `ate`, contando os dois (janela inclusiva). */
export function diasDaJanela(de: string, ate: string): number {
  return (
    Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / MS_POR_DIA) + 1
  );
}
