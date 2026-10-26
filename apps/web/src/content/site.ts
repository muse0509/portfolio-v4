export const siteRoutes = {
  home: "#top",
  about: "#profile",
  contact: "#contact",
  axis: "#axis",
  works: "/works",
} as const;

export type ProfileSocialIcon = "x" | "linkedin" | "github" | "email";

export const siteContent = {
  metadata: {
    title: "Yusuke Kikuta | Full-Stack Engineer",
    description:
      "事業を理解し、要件定義から設計・実装・改善までを一貫して進めるフルスタックエンジニアのポートフォリオ。",
  },
  identity: {
    name: "Yusuke Kikuta",
    role: "フルスタックエンジニア",
  },
  routes: siteRoutes,
  navigation: {
    label: "メインナビゲーション",
    menuOpenLabel: "メニューを開く",
    menuCloseLabel: "メニューを閉じる",
    items: [
      { label: "トップ", href: siteRoutes.home },
      { label: "Axis", href: siteRoutes.axis },
      { label: "プロフィール", href: siteRoutes.about },
    ],
    contact: { label: "相談する", href: siteRoutes.contact },
  },
  hero: {
    headline: "構想を、動くプロダクトまで。",
    headlineLines: ["構想を、", "動くプロダクトまで。"],
    headlineLinesMobile: ["構想を、", "動くプロダクト", "まで。"],
    description: {
      lead: "事業の意図を理解し、要件整理から",
      focus: "設計・実装・改善",
      suffix: "まで。",
      closing: "0→1のプロダクト開発を一貫して進めます。",
    },
    primaryAction: { label: "相談する", href: siteRoutes.contact },
    secondaryAction: { label: "Axisを見る", href: siteRoutes.axis },
  },
  axisFeaturedWork: {
    sectionLabel: "SELECTED WORK / 01",
    worksAction: {
      label: "すべての実績を見る",
      href: siteRoutes.works,
    },
    productName: "Axis",
    logoSrc: "/media/axis/axis-logo.svg" as string | null,
    displayLine: "構想から市場へ。",
    videoSrc: "/media/axis/axis-teaser.mp4" as string | null,
    posterSrc: "/media/axis/axis-teaser-poster.webp" as string | null,
    durationLabel: "00:42",
    description:
      "Solana上で、誰でも複数資産をひとつのバスケットとして扱えるプロダクト。",
    ownership:
      "要件定義、UI設計、フロントエンド、バックエンド、公開、ローンチ後のマーケティングまで一貫して推進。",
    facts: [
      { lead: "約1か月で", value: "再構築" },
      { lead: "Devnet", value: "約400ユーザー" },
      { lead: "2,100件超の", value: "ETF作成" },
    ],
    environment: "Devnet",
    disclaimer: "実資金取引なし",
    appAction: {
      label: "Axisアプリを開く",
      accessibleLabel: "Axisアプリを新しいタブで開く",
      href: "https://dev.axs.pizza",
    },
    repositoryAction: {
      label: "GitHubでAxis_MVPを見る",
      accessibleLabel: "AxisのGitHubリポジトリを新しいタブで開く",
      href: "https://github.com/Axis-pizza/Axis_MVP",
    },
  },
  worksPage: {
    introduction: {
      heading: {
        lead: "要件定義から",
        scope: "設計・実装・公開",
        continuation: "公開後の改善とマーケティングまで。",
      },
      description:
        "事業と技術の間に立ち、0→1のプロダクトを前へ進めてきました。",
      period: "2024–2026",
      fields: ["プロダクト開発", "AI自動化", "Solana"],
      note: "一部機密性の高いプロジェクトは、詳細を非公開としています。",
    },
    axis: {
      number: "01",
      period: "2025.04–現在",
      category: "オンチェーン・バスケット型DeFiプロダクト",
      role: "技術責任者 / プロダクト・フルスタック",
      scope: [
        "要件定義",
        "UI設計",
        "フロントエンド",
        "バックエンド",
        "公開",
        "マーケティング",
      ],
    },
    projects: [
      {
        number: "02",
        period: ["2024.08", "2025.02"],
        title: "AI営業オートメーション",
        description:
          "AIを活用し、営業リードの獲得からナーチャリングまでを自動化。リサーチ、スコアリング、アプローチを一つの流れに統合。",
        outcome: ["400件以上のリード獲得"],
        scope: ["要件定義", "設計", "実装", "公開", "改善", "マーケティング"],
      },
      {
        number: "03",
        period: ["2024.08", "2025.02"],
        title: "Solana DeFi Vault Interface",
        description:
          "Solana上のVault運用を可視化し、意思決定を支えるダッシュボード。オンチェーンデータを統合し、高度な集計体験を実現。",
        outcome: ["フロントエンド", "オンチェーン統合"],
        scope: ["要件定義", "UI設計", "フロントエンド", "バックエンド", "公開"],
      },
      {
        number: "04",
        period: ["2025.03", "2025.05"],
        title: "生成AI・RAG業務支援アプリ",
        description:
          "社内ナレッジの検索と要約生成を支援する業務アプリ。RAG構成により、精度の高い回答と運用効率化を実現。",
        outcome: ["フロントエンド実装"],
        scope: ["要件定義", "設計", "フロントエンド", "バックエンド", "公開"],
      },
      {
        number: "05",
        period: ["2025.06", "2025.09"],
        title: "スタートアップMVP開発支援",
        description:
          "複数のスタートアップに伴走し、MVP開発を支援。技術選定から設計、実装、リリースまでをメンタリング。",
        outcome: ["エンジニアメンター", "開発チーム"],
        scope: ["要件定義", "設計", "実装", "コードレビュー", "メンタリング"],
      },
    ],
    recognition: {
      heading: "受賞・登壇",
      awards: {
        heading: "受賞",
        items: [
          {
            title: "Breakout Hackathon",
            detail: "Zee Prime Capital Sidetrack / 1st Place",
          },
          {
            title: "Colosseum Frontier Hackathon",
            detail: "Superteam Japan Track / Winner",
          },
          {
            title: "Sol Hack3rs Global Hackathon",
            detail: "Slash Vision Labs Award / Audience Award",
          },
        ],
      },
      speaking: {
        heading: "登壇",
        items: [
          {
            date: "2026.02",
            organizer: "mtnDAO",
            eventName: "Demo Day",
            location: "Salt Lake City",
            detail: "Axis Pitch",
          },
          {
            date: "2026.05",
            organizer: "MonkeFoundry × Solana",
            eventName: "Demo Day",
            location: "Miami",
            detail: "Axis Pitch",
          },
        ],
      },
    },
  },
  profile: {
    heading: "プロフィール",
    name: "Yusuke Kikuta",
    role: "フルスタックエンジニア",
    introduction:
      "事業と実装の間に立ち、曖昧な構想を検証可能なプロダクトへ進めることを大切にしています。",
    biography: [
      "音楽大学でトランペットを学びながら、在学中からエンジニアとして複数の開発案件に従事。その後、大学を自主退学し、Solana上のプロダクト「Axis」の開発・運営にフルコミットしました。",
      "要件定義、UI実装、API・データベース、オンチェーン連携から、公開後の運営・マーケティングまで、プロダクトづくりを一貫して担ってきました。",
    ],
    photo: {
      src: "/media/axis/yusukekikuta.jpeg",
      alt: "Yusuke Kikutaのプロフィール写真",
    },
    socialLinks: [
      {
        label: "X",
        href: "https://x.com/muse_jp_sol",
        icon: "x" as ProfileSocialIcon,
        external: true,
      },
      {
        label: "LinkedIn",
        href: "https://www.linkedin.com/in/yusukekikuta",
        icon: "linkedin" as ProfileSocialIcon,
        external: true,
      },
      {
        label: "GitHub",
        href: "https://github.com/muse0509",
        icon: "github" as ProfileSocialIcon,
        external: true,
      },
      {
        label: "Email",
        href: "mailto:yusukekikuta.05@gmail.com",
        icon: "email" as ProfileSocialIcon,
        external: false,
      },
    ],
  },
  contact: {
    heading: "まず、相談内容を聞かせてください。",
    description:
      "お問い合わせ窓口は現在準備中です。公開できる連絡方法が整い次第、ここから相談内容を送れるようにします。",
    availability: "お問い合わせ窓口を準備しています",
  },
} as const;
