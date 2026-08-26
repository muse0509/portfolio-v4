import { siteContent } from "@/content/site";

export function SiteFooter() {
  const { footer, identity, navigation } = siteContent;

  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__inner">
        <div className="site-footer__identity">
          <p>{identity.name}</p>
          <p>{identity.role}</p>
        </div>
        <nav className="site-footer__navigation" aria-label="フッターナビゲーション">
          {navigation.items.map((item) => (
            <a className="focus-ring" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
          <a className="focus-ring" href={navigation.contact.href}>
            {navigation.contact.label}
          </a>
        </nav>
        <p className="site-footer__note">{footer.note}</p>
      </div>
    </footer>
  );
}
