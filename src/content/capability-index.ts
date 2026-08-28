import type { IconDefinition } from "@fortawesome/free-brands-svg-icons";
import { faOpenai } from "@fortawesome/free-brands-svg-icons/faOpenai";
import type { SimpleIcon } from "simple-icons";
import {
  siCloudflare,
  siCloudflarepages,
  siCloudflareworkers,
  siDrizzle,
  siGithub,
  siHono,
  siJavascript,
  siNextdotjs,
  siPython,
  siReact,
  siSelenium,
  siSolana,
  siSqlite,
  siTailwindcss,
  siTypescript,
  siVite,
} from "simple-icons";

export type CapabilityTechnology = {
  readonly name: string;
  readonly duration: string;
  readonly icon?: SimpleIcon | IconDefinition;
};

export type CapabilityCategory = {
  readonly id: string;
  readonly label: string;
  readonly technologies: readonly CapabilityTechnology[];
};

export const capabilityIndexHeader = {
  eyebrow: "CAPABILITY INDEX / 2026.08",
  heading: "対応できる領域",
  description:
    "実務案件と継続中の自社プロダクトで使用した技術のみを掲載。",
  note: "期間は2026年8月時点の概算。重複する案件期間は合算していません。",
} as const;

export const coreTechnologies: readonly CapabilityTechnology[] = [
  { name: "TypeScript", duration: "2年", icon: siTypescript },
  { name: "React", duration: "2年", icon: siReact },
  { name: "Solana Web3.js", duration: "2年", icon: siSolana },
  {
    name: "Cloudflare Platform",
    duration: "1年以上",
    icon: siCloudflare,
  },
  { name: "Python", duration: "1年", icon: siPython },
  { name: "OpenAI API", duration: "1年", icon: faOpenai },
];

export const extendedTechnologyCategories: readonly CapabilityCategory[] = [
  {
    id: "web",
    label: "WEB",
    technologies: [
      { name: "JavaScript", duration: "2年", icon: siJavascript },
      { name: "Next.js", duration: "1年以上", icon: siNextdotjs },
      { name: "Vite", duration: "1年以上", icon: siVite },
      { name: "Tailwind CSS", duration: "1年以上", icon: siTailwindcss },
    ],
  },
  {
    id: "backend-data",
    label: "BACKEND & DATA",
    technologies: [
      { name: "Hono", duration: "1年以上", icon: siHono },
      {
        name: "Cloudflare Workers",
        duration: "1年以上",
        icon: siCloudflareworkers,
      },
      { name: "D1 / SQLite", duration: "1年以上", icon: siSqlite },
      { name: "Drizzle ORM", duration: "1年以上", icon: siDrizzle },
    ],
  },
  {
    id: "automation-delivery",
    label: "AUTOMATION & DELIVERY",
    technologies: [
      { name: "Selenium", duration: "1年未満", icon: siSelenium },
      { name: "Git / GitHub", duration: "2年", icon: siGithub },
      {
        name: "Cloudflare Pages",
        duration: "1年以上",
        icon: siCloudflarepages,
      },
      { name: "AWS", duration: "1年未満" },
    ],
  },
];
