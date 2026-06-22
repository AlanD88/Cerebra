import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  DashboardIcon,
  GraphIcon,
  ReviewsIcon,
  SettingsIcon,
  SubjectsIcon,
} from './icons';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon />, end: true },
  { to: '/subjects', label: 'Subjects', icon: <SubjectsIcon /> },
  { to: '/graph', label: 'Knowledge Graph', icon: <GraphIcon /> },
  { to: '/review', label: 'Reviews', icon: <ReviewsIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

/**
 * 52px icon-only Forest sidebar. Expands to reveal labels on hover; positioned
 * fixed so the expansion overlays the canvas rather than reflowing it.
 */
export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="group fixed left-0 top-0 z-40 flex h-screen w-[52px] flex-col overflow-hidden bg-forest text-cream transition-[width] duration-normal ease-standard hover:w-[208px]"
    >
      <div className="flex h-[52px] w-full shrink-0 items-center">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center font-display text-h2 leading-none text-sand">
          C
        </span>
        <span className="whitespace-nowrap font-display text-body-lg text-cream opacity-0 transition-opacity duration-fast group-hover:opacity-100">
          Cerebra
        </span>
      </div>

      <ul className="mt-2 flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex h-11 w-full items-center text-cream/80 transition-colors duration-fast hover:text-cream',
                  isActive ? 'bg-cream/10 text-cream' : '',
                ].join(' ')
              }
            >
              <span className="flex h-11 w-[52px] shrink-0 items-center justify-center">
                {item.icon}
              </span>
              <span className="whitespace-nowrap text-body opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                {item.label}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
