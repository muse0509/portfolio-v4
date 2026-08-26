export const siteRoutes = {
  home: "#top",
  works: "#works",
  process: "#process",
  about: "#about",
  contact: "#contact",
  axis: "#axis",
  contactStatus: "#contact-status",
} as const;

export const siteContent = {
  metadata: {
    title: "Yusuke Kikuta | Full-Stack Engineer",
    description:
      "事業を理解し、要件定義から設計・実装・改善までを一貫して進めるフルスタックエンジニアのポートフォリオ。",
  },
  identity: {
    name: "Yusuke Kikuta",
    role: "Full-Stack Engineer",
  },
  routes: siteRoutes,
  navigation: {
    label: "メインナビゲーション",
    menuOpenLabel: "メニューを開く",
    menuCloseLabel: "メニューを閉じる",
    items: [
      { label: "トップ", href: siteRoutes.home },
      { label: "実績", href: siteRoutes.works },
      { label: "開発アプローチ", href: siteRoutes.process },
      { label: "プロフィール", href: siteRoutes.about },
    ],
    contact: { label: "Contact", href: siteRoutes.contact },
  },
  hero: {
    eyebrow: "Full-Stack Engineer",
    headline: "構想を、動くプロダクトまで。",
    headlineLines: ["構想を、", "動くプロダクトまで。"],
    description:
      "事業の意図を理解し、要件整理から設計・実装・改善まで。0→1のプロダクト開発を一貫して進めます。",
    primaryAction: { label: "相談内容を共有する", href: siteRoutes.contact },
    secondaryAction: { label: "Axisを見る", href: siteRoutes.axis },
  },
  proof: [
    { label: "0→1 Product", detail: "構想から実装まで" },
    { label: "Full-Stack", detail: "境界を越えて設計" },
    { label: "Axis / Flagship", detail: "ケーススタディ準備中" },
  ],
  axis: {
    eyebrow: "Selected Work",
    title: "Axis / Flagship",
    description:
      "プロダクトの目的と利用フローを起点に、公開可能な設計・実装範囲を整理しています。",
    disclaimer: "Devnet / 実資金取引なし",
    mediaLabel: "Axis product capture / pending",
  },
  evidence: {
    label: "Axis / Case Study",
    heading: "Axisの実装背景と責任範囲",
    items: [
      {
        title: "Context",
        body: "課題、利用者、プロダクトの前提を確認し、公開できる背景情報を整理中です。",
      },
      {
        title: "Role",
        body: "要件整理、設計、実装のうち、検証済みの担当範囲を確認して掲載します。",
      },
      {
        title: "Outcome",
        body: "数値や成果は作らず、確認できた事実とDevnetでの検証内容だけを公開します。",
      },
    ],
  },
  responsibility: {
    heading: "Responsibility Timeline",
    stages: ["Discovery", "Design", "Frontend", "Backend", "Onchain", "Ship"],
  },
  selectedWorks: {
    heading: "Selected Works",
    items: [
      {
        number: "02",
        title: "Project 02",
        description: "公開内容を確認後、ケーススタディを追加します。",
        status: "Details / Pending",
        mediaLabel: "Project 02 media / pending",
      },
      {
        number: "03",
        title: "Project 03",
        description: "実績情報と素材の確認後に差し替えます。",
        status: "Details / Pending",
        mediaLabel: "Project 03 media / pending",
      },
    ],
  },
  capabilities: {
    heading: "Capabilities",
    items: [
      {
        title: "Product Engineering",
        body: "事業要件を、検証できるプロダクトの形へ落とし込みます。",
      },
      {
        title: "Frontend",
        body: "TypeScript / React / Next.jsを軸に、使いやすいUIを実装します。",
      },
      {
        title: "Backend / Cloud",
        body: "API、データ、運用境界を含めて、公開後を見据えて設計します。",
      },
      {
        title: "Web3 / Solana",
        body: "必要なプロジェクトでは、Solana固有の実装要件にも対応します。",
      },
    ],
  },
  process: {
    heading: "Process",
    items: [
      {
        number: "01",
        title: "Discover",
        body: "目的、利用者、制約を揃える。",
      },
      {
        number: "02",
        title: "Define",
        body: "要件と優先順位を決める。",
      },
      {
        number: "03",
        title: "Build",
        body: "小さく実装し、確かめる。",
      },
      {
        number: "04",
        title: "Ship & Improve",
        body: "公開し、学びを次へ反映する。",
      },
    ],
  },
  about: {
    heading: "About",
    name: "Yusuke Kikuta",
    role: "Full-Stack Engineer",
    description:
      "事業と実装の間に立ち、曖昧な構想を検証可能なプロダクトへ進めることを大切にしています。",
    mediaLabel: "Portrait / pending",
  },
  writing: {
    heading: "Writing",
    description: "テーマと公開内容を確認後に追加します。",
    items: [
      { title: "Writing 01", status: "Topic / Pending" },
      { title: "Writing 02", status: "Topic / Pending" },
      { title: "Writing 03", status: "Topic / Pending" },
    ],
  },
  contact: {
    eyebrow: "Contact",
    heading: "構想を、動くプロダクトまで。",
    headingLines: ["構想を、", "動くプロダクトまで。"],
    description:
      "相談内容と公開可能な連絡先を確認後、問い合わせ導線を接続します。",
    action: { label: "相談導線を確認する", href: siteRoutes.contactStatus },
    status: "Contact route / preparing",
  },
  footer: {
    note: "Product Cinema / First implementation",
  },
} as const;
