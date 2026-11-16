/**
 * Datas do atleta são sempre texto `AAAA-MM-DD` (o dia local que a Garmin informa). Contas com
 * dias usam UTC só como régua: nenhum horário de verão ou fuso entra aqui.
 */

const MS_POR_DIA = 86_400_000;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

export type Dia = string;

/** Número de dias desde 1970-01-01. Recusa data inexistente (por exemplo, 2026-02-30). */
export function numeroDoDia(dia: Dia): number {
  const partes = FORMATO.exec(dia);
  const [, ano, mes, diaDoMes] = partes ?? [];
  if (ano === undefined || mes === undefined || diaDoMes === undefined) {
    throw new RangeError(`Data precisa ser AAAA-MM-DD; recebido: ${dia}`);
  }
  const dias = Date.UTC(Number(ano), Number(mes) - 1, Number(diaDoMes)) / MS_POR_DIA;
  if (diaDeNumero(dias) !== dia) throw new RangeError(`Data inexistente: ${dia}`);
  return dias;
}

export function diaDeNumero(dias: number): Dia {
  return new Date(dias * MS_POR_DIA).toISOString().slice(0, 10);
}

export function somarDias(dia: Dia, dias: number): Dia {
  return diaDeNumero(numeroDoDia(dia) + dias);
}

/** Quantos dias de `de` até `ate` (negativo se `ate` vem antes). */
export function diasEntre(de: Dia, ate: Dia): number {
  return numeroDoDia(ate) - numeroDoDia(de);
}

/** Segunda-feira da semana do dia (semana de calendário, segunda a domingo). */
export function inicioDaSemana(dia: Dia): Dia {
  const numero = numeroDoDia(dia);
  const diaDaSemana = new Date(numero * MS_POR_DIA).getUTCDay(); // 0 = domingo
  return diaDeNumero(numero - ((diaDaSemana + 6) % 7));
}
