"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type NavigationItem = {
  readonly label: string;
  readonly href: string;
};

type SiteHeaderProps = {
  homeHref: string;
  identity: {
    readonly name: string;
    readonly role: string;
  };
  navigation: {
    readonly label: string;
    readonly menuOpenLabel: string;
    readonly menuCloseLabel: string;
    readonly items: readonly NavigationItem[];
    readonly contact: NavigationItem;
  };
};

export function SiteHeader({ homeHref, identity, navigation }: SiteHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = usePrefersReducedMotion();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    firstMenuLinkRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <div className="page-shell site-header__inner">
        <a className="site-brand focus-ring" href={homeHref} aria-label="トップへ戻る">
          <span className="site-brand__name">{identity.name}</span>
          <span className="site-brand__role">{identity.role}</span>
        </a>

        <nav className="desktop-navigation" aria-label={navigation.label}>
          {navigation.items.map((item) => (
            <a className="navigation-link focus-ring" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <a
          className="header-contact focus-ring"
          href={navigation.contact.href}
        >
          {navigation.contact.label}
        </a>

        <button
          ref={menuButtonRef}
          className="menu-button focus-ring"
          type="button"
          aria-controls="mobile-navigation"
          aria-expanded={isOpen}
          aria-label={
            isOpen ? navigation.menuCloseLabel : navigation.menuOpenLabel
          }
          onClick={() => setIsOpen((current) => !current)}
        >
          <span aria-hidden="true" className="menu-button__icon">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.nav
            id="mobile-navigation"
            className="mobile-navigation"
            aria-label={navigation.label}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.2,
              ease: [0, 0, 0.2, 1],
            }}
          >
            <div className="page-shell mobile-navigation__inner">
              {navigation.items.map((item, index) => (
                <a
                  ref={index === 0 ? firstMenuLinkRef : undefined}
                  className="mobile-navigation__link focus-ring"
                  href={item.href}
                  key={item.href}
                  onClick={closeMenu}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true">↘</span>
                </a>
              ))}
              <a
                className="mobile-navigation__contact focus-ring"
                href={navigation.contact.href}
                onClick={closeMenu}
              >
                {navigation.contact.label}
              </a>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
