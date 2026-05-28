"use client";

import { useId } from "react";

interface TooltipProps {
  text: string;
  placement?: "top" | "bottom";
  children: React.ReactNode;
}

export function Tooltip({ text, placement = "bottom", children }: TooltipProps) {
  const id = useId();

  return (
    <div className="tooltip-host">
      <div aria-describedby={id}>{children}</div>
      <div id={id} role="tooltip" className={`tooltip-bubble tooltip-bubble--${placement}`}>
        {text}
      </div>
    </div>
  );
}
