import type { ReactNode } from 'react';

type Surface = 'paper' | 'glass' | 'floating';

const SURFACE: Record<Surface, string> = {
  paper: 'surface-paper',
  glass: 'surface-glass',
  floating: 'surface-floating',
};

interface CardProps {
  children: ReactNode;
  surface?: Surface;
  className?: string;
}

export function Card({ children, surface = 'paper', className = '' }: CardProps) {
  return <section className={`card-reveal ${SURFACE[surface]} p-5 ${className}`}>{children}</section>;
}

interface CardHeadingProps {
  title: string;
  hint?: string;
  right?: ReactNode;
}

export function CardHeading({ title, hint, right }: CardHeadingProps) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold text-charcoal">
        {title}
        {hint && <span className="ml-1.5 font-normal text-charcoal/45">· {hint}</span>}
      </h2>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
