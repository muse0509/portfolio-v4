import type { IconDefinition } from "@fortawesome/free-brands-svg-icons";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons/faLinkedin";
import Image from "next/image";
import { siGithub, siX, type SimpleIcon } from "simple-icons";

import { TechIcon } from "@/components/ui/tech-icon";
import { siteContent, type ProfileSocialIcon } from "@/content/site";

const profileSocialIcons: Record<
  Exclude<ProfileSocialIcon, "email">,
  SimpleIcon | IconDefinition
> = {
  x: siX,
  linkedin: faLinkedin,
  github: siGithub,
};

function EmailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="profile-social__icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M3.75 6.75h16.5v10.5H3.75V6.75Zm.75.75 7.5 5.25 7.5-5.25"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SocialIcon({ icon }: { readonly icon: ProfileSocialIcon }) {
  if (icon === "email") {
    return <EmailIcon />;
  }

  return (
    <TechIcon
      className="profile-social__icon"
      icon={profileSocialIcons[icon]}
    />
  );
}

export function ProfileSection() {
  const { profile } = siteContent;

  return (
    <section
      id="profile"
      className="profile section-band"
      aria-labelledby="profile-heading"
      data-section="profile"
    >
      <div className="page-shell profile__layout">
        <h2 id="profile-heading" className="section-heading profile__heading">
          {profile.heading}
        </h2>

        <div
          aria-hidden={profile.photo.src ? undefined : true}
          className="profile__photo"
          data-photo-state={profile.photo.src ? "available" : "placeholder"}
        >
          {profile.photo.src ? (
            <Image
              fill
              alt={profile.photo.alt}
              className="profile__photo-image"
              sizes="(min-width: 640px) 168px, (min-width: 330px) calc(37vw - 18px), 104px"
              src={profile.photo.src}
            />
          ) : null}
        </div>

        <div className="profile__content">
          <div className="profile__identity">
            <p className="profile__name">{profile.name}</p>
            <p className="profile__role">{profile.role}</p>
          </div>

          <p className="profile__introduction">{profile.introduction}</p>

          <div className="profile__biography">
            {profile.biography.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {profile.socialLinks.length > 0 ? (
            <nav
              className="profile-social"
              aria-label="プロフィールの外部リンク"
            >
              <ul>
                {profile.socialLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      aria-label={link.label}
                      className="profile-social__link focus-ring"
                      href={link.href}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      target={link.external ? "_blank" : undefined}
                    >
                      <SocialIcon icon={link.icon} />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  );
}
