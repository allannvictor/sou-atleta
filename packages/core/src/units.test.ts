import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { averagePace, formatPace, paceToSpeed, speedToPace } from "./units.js";

const runningSpeed = fc.double({ min: 0.5, max: 12, noNaN: true });
const runningPace = fc.double({ min: 120, max: 1200, noNaN: true });

describe("speedToPace / paceToSpeed", () => {
  it("ida e volta devolve o valor original", () => {
    fc.assert(
      fc.property(runningSpeed, (speed) => {
        expect(paceToSpeed(speedToPace(speed))).toBeCloseTo(speed, 9);
      }),
    );
  });

  it("correr mais rápido sempre dá um ritmo menor", () => {
    fc.assert(
      fc.property(runningSpeed, runningSpeed, (a, b) => {
        fc.pre(a < b);
        expect(speedToPace(b)).toBeLessThan(speedToPace(a));
      }),
    );
  });

  it("recusa velocidade zero, negativa ou inválida", () => {
    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => speedToPace(invalid)).toThrow(RangeError);
    }
  });
});

describe("averagePace", () => {
  it("10 km em 50 minutos dá 5:00/km", () => {
    expect(formatPace(averagePace(10_000, 3_000))).toBe("5:00/km");
  });

  it("concorda com speedToPace para a mesma corrida", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 100_000, noNaN: true }),
        fc.double({ min: 60, max: 30_000, noNaN: true }),
        (distance, duration) => {
          expect(averagePace(distance, duration)).toBeCloseTo(speedToPace(distance / duration), 6);
        },
      ),
    );
  });
});

describe("formatPace", () => {
  it("sempre produz m:ss/km com segundos entre 00 e 59", () => {
    fc.assert(
      fc.property(runningPace, (pace) => {
        expect(formatPace(pace)).toMatch(/^\d+:[0-5]\d\/km$/);
      }),
    );
  });

  it("arredonda 4:59,6 para 5:00, sem gerar 4:60", () => {
    expect(formatPace(299.6)).toBe("5:00/km");
  });
});
