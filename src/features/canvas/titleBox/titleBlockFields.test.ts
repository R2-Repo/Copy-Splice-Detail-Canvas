import { describe, expect, it } from "vitest";

import {
  resolveTitleBlock,
  titleBlockFromHeader,
} from "@/features/canvas/titleBox/titleBlockFields";

describe("titleBlockFields", () => {
  it("falls back splice number into desc when CSV desc is blank", () => {
    const block = titleBlockFromHeader({
      spliceNumber: "SP-3254.5",
    });
    expect(block.description).toBe("SP-3254.5");
  });

  it("keeps user edits including cleared fields after reload merge", () => {
    const header = {
      street: "3300 S",
      cityState: "SALT LAKE",
      description: "UDOT",
    };
    const merged = resolveTitleBlock(header, {
      street: "",
      description: "My edit",
    });
    expect(merged.street).toBe("");
    expect(merged.description).toBe("My edit");
    expect(merged.cityState).toBe("SALT LAKE");
  });
});
