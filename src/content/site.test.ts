import { describe, expect, it } from "vitest";

import { siteContent } from "./site";

describe("siteContent", () => {
  it("keeps the agreed identity and hero copy", () => {
    expect(siteContent.identity.name).toBe("Yusuke Kikuta");
    expect(siteContent.identity.role).toBe("フルスタックエンジニア");
    expect(siteContent.hero.headlineLines.join("")).toBe(
      siteContent.hero.headline,
    );
    expect(Object.values(siteContent.hero.description).join("")).toBe(
      "事業の意図を理解し、要件整理から設計・実装・改善まで。0→1のプロダクト開発を一貫して進めます。",
    );
    expect(siteContent.navigation.items.map(({ label }) => label)).toEqual([
      "トップ",
      "Axis",
      "プロフィール",
    ]);
  });

  it("keeps Axis claims factual and separates the environment label", () => {
    expect(siteContent.axisFeaturedWork.environment).toBe("Devnet");
    expect(siteContent.axisFeaturedWork.disclaimer).toBe("実資金取引なし");
    expect(siteContent.axisFeaturedWork.facts).toEqual([
      { lead: "約1か月で", value: "再構築" },
      { lead: "Devnet", value: "約400ユーザー" },
      { lead: "2,100件超の", value: "ETF作成" },
    ]);
  });

  it("uses the verified local Axis media", () => {
    expect(siteContent.axisFeaturedWork.logoSrc).toBe(
      "/media/axis/axis-logo.svg",
    );
    expect(siteContent.axisFeaturedWork.videoSrc).toBe(
      "/media/axis/axis-teaser.mp4",
    );
    expect(siteContent.axisFeaturedWork.posterSrc).toBe(
      "/media/axis/axis-teaser-poster.webp",
    );
    expect(siteContent.axisFeaturedWork.appAction.href).toBe(
      "https://dev.axs.pizza",
    );
    expect(siteContent.axisFeaturedWork.repositoryAction.href).toBe(
      "https://github.com/Axis-pizza/Axis_MVP",
    );
  });

  it("keeps the works page complete without project detail routes", () => {
    expect(siteContent.worksPage.projects).toHaveLength(4);
    expect(siteContent.worksPage.projects.map((project) => project.title)).toEqual([
      "AI営業オートメーション",
      "Solana DeFi Vault Interface",
      "生成AI・RAG業務支援アプリ",
      "スタートアップMVP開発支援",
    ]);
    expect(
      siteContent.worksPage.projects.every(
        (project) => !("href" in project),
      ),
    ).toBe(true);
    expect(siteContent.worksPage.recognition.awards.items).toHaveLength(3);
    expect(siteContent.worksPage.recognition.speaking.items).toHaveLength(2);
  });
});
