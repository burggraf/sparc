import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";

afterEach(cleanup);

describe("SPARC desktop shell", () => {
  it("offers two honest local archive tasks", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "SPARC" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Local artifact archives only — this does not back up Supabase yet.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect supabase/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create archive" }));
    expect(
      screen.getByRole("heading", { name: "Create an encrypted archive" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Open archive" }));
    expect(
      screen.getByRole("heading", { name: "Open an encrypted archive" }),
    ).toBeInTheDocument();
  });
});
