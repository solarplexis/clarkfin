"use client";

import { cloneElement, isValidElement, useId } from "react";

interface TooltipProps {
  text: string;
  placement?: "top" | "bottom";
  children: React.ReactElement;
}

export function Tooltip({ text, placement = "bottom", children }: TooltipProps) {
  const id = useId();

  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, { "aria-describedby": id })
    : children;

  return (
    <div className="tooltip-host">
      {trigger}
      <div id={id} role="tooltip" className={`tooltip-bubble tooltip-bubble--${placement}`}>
        {text}
      </div>
    </div>
  );
}
