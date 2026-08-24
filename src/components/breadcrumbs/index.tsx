import classNames from "classnames";
import { ChevronRight } from "lucide-react";
import Link from "../link";
import { LI } from "../text";
import s from "./Breadcrumbs.module.css";

export interface Breadcrumb {
  text: string;
  href: string | null;
}

interface BreadcrumbsProps {
  className?: string;
  breadcrumbs: Breadcrumb[];
}

export default function Breadcrumbs({
  className,
  breadcrumbs,
}: BreadcrumbsProps) {
  return (
    <ul className={classNames(s.breadcrumbs, className)}>
      {breadcrumbs.map((breadcrumb, i) => (
        <LI weight="regular" key={breadcrumb.href ?? breadcrumb.text}>
          {breadcrumb.href ? (
            <Link
              className={classNames({
                [s.active]: i + 1 === breadcrumbs.length,
              })}
              href={breadcrumb.href}
              text={breadcrumb.text}
            />
          ) : (
            breadcrumb.text
          )}
          {i + 1 < breadcrumbs.length && (
            <ChevronRight className={s.chevron} size={16} strokeWidth={3} />
          )}
        </LI>
      ))}
    </ul>
  );
}
