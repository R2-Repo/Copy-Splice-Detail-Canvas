import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HelpGuideOverlay } from "./HelpGuideOverlay";

describe("HelpGuideOverlay", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <HelpGuideOverlay open={false} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the guide dialog with visual sections when open", () => {
    render(<HelpGuideOverlay open onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Help and guide" })).toBeInTheDocument();
    expect(screen.getByText("Get started")).toBeInTheDocument();
    expect(screen.getByText("Hold line → protect")).toBeInTheDocument();
    expect(screen.getByText("Drag cable ↔")).toBeInTheDocument();
    expect(screen.getByText("Tube tip ↕")).toBeInTheDocument();
    expect(screen.getByText("Report")).toBeInTheDocument();
  });

  it("calls onClose from Close button and Escape", () => {
    const onClose = vi.fn();
    render(<HelpGuideOverlay open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
