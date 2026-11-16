import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { diasEntre, inicioDaSemana, numeroDoDia, somarDias } from "./datas.js";

describe("datas", () => {
  it("soma dias atravessando mês, ano e fevereiro bissexto", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("recusa data malformada ou inexistente", () => {
    expect(() => numeroDoDia("2026-02-30")).toThrow(RangeError);
    expect(() => numeroDoDia("15/11/2026")).toThrow(RangeError);
  });

  it("a semana começa na segunda-feira", () => {
    expect(inicioDaSemana("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(inicioDaSemana("2026-11-09")).toBe("2026-11-09"); // segunda
    expect(inicioDaSemana("2026-11-12")).toBe("2026-11-09"); // quinta
  });

  it("propriedade: somar e medir dias dá a ida e volta", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -3000, max: 3000 }),
        (n) => diasEntre("2026-06-15", somarDias("2026-06-15", n)) === n,
      ),
    );
  });
});
