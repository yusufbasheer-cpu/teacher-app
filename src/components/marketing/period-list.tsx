import type { ReactNode } from "react";

/**
 * Numbered margin rule — the "Term Planner" signature element. Only use for
 * content that is genuinely sequential (a process, a set of ordered steps);
 * it borrows the visual logic of a school timetable's period column.
 */
export function PeriodList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-8 ${className}`}>{children}</div>;
}

export function PeriodItem({
  number,
  children,
  className = "",
}: {
  number: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative border-l-2 border-navy-rule/30 pl-6 ${className}`}>
      <span className="font-mono-editorial absolute left-0 top-0.5 -translate-x-1/2 bg-background pr-1.5 text-xs font-medium text-primary">
        {number}
      </span>
      {children}
    </div>
  );
}
