import { describe, expect, it } from "vitest";

import {
  capabilityIndexHeader,
  coreTechnologies,
  extendedTechnologyCategories,
} from "./capability-index";

describe("capabilityIndex", () => {
  it("keeps the reviewed hierarchy and experience durations", () => {
    expect(capabilityIndexHeader.eyebrow).toBe("CAPABILITY INDEX / 2026.08");
    expect(coreTechnologies.map(({ name, duration }) => [name, duration])).toEqual([
      ["TypeScript", "2年"],
      ["React", "2年"],
      ["Solana Web3.js", "2年"],
      ["Cloudflare Platform", "1年以上"],
      ["Python", "1年"],
      ["OpenAI API", "1年"],
    ]);
    expect(extendedTechnologyCategories).toHaveLength(3);
    expect(
      extendedTechnologyCategories.flatMap((category) => category.technologies),
    ).toHaveLength(12);
    expect(
      extendedTechnologyCategories.map((category) => category.label),
    ).toEqual(["WEB", "BACKEND & DATA", "AUTOMATION & DELIVERY"]);
  });

  it("does not duplicate technology names across the two levels", () => {
    const names = [
      ...coreTechnologies.map((technology) => technology.name),
      ...extendedTechnologyCategories.flatMap((category) =>
        category.technologies.map((technology) => technology.name),
      ),
    ];

    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps only the requested extended technologies and mark treatment", () => {
    const technologies = extendedTechnologyCategories.flatMap(
      (category) => category.technologies,
    );
    const names = technologies.map((technology) => technology.name);

    expect(names).not.toEqual(
      expect.arrayContaining([
        "REST API",
        "RAG",
        "Wallet Adapter",
        "Jupiter",
        "SPL Token",
      ]),
    );
    expect(coreTechnologies.find(({ name }) => name === "OpenAI API")?.icon).toBeDefined();
    expect(technologies.find(({ name }) => name === "AWS")?.icon).toBeUndefined();
  });
});
