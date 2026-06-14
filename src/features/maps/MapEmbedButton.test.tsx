import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapEmbedButton } from "./MapEmbedButton";

describe("MapEmbedButton", () => {
  it("shows a location-missing message when the CSV header has no coordinates", () => {
    render(
      <MapEmbedButton
        location={undefined}
        spliceLabel={undefined}
        icon={<span aria-hidden>map</span>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show splice location on map" }));
    expect(screen.getByText("No location in CSV header.")).toBeInTheDocument();
  });

  it("renders ArcGIS iframe by default, then Google Maps satellite tab", () => {
    render(
      <MapEmbedButton
        location="40.696435 -112.038535"
        spliceLabel="SP-2724.5"
        icon={<span aria-hidden>map</span>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show splice location on map" }));

    const uplanFrame = screen.getByTitle("uPlan ArcGIS map");
    expect(uplanFrame).toHaveAttribute("src");
    expect(uplanFrame.getAttribute("src")).toContain("uplan.maps.arcgis.com");
    expect(uplanFrame.getAttribute("src")).toContain("center=-112.038535%2C40.696435");

    fireEvent.click(screen.getByRole("tab", { name: "Google Maps" }));
    const satelliteFrame = screen.getByTitle("Google Maps satellite preview");
    expect(satelliteFrame.getAttribute("src")).toContain("maps.google.com");
    expect(satelliteFrame.getAttribute("src")).toContain("t=k");
  });
});
