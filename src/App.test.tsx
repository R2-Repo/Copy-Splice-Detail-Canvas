import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the toolbar without an app title", () => {
    render(<App />);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import file" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Import diagram config" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open connection inspector" }),
    ).toBeInTheDocument();
  });
});
