import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { AppDownloadBanner } from "./app-download-banner.js";

describe("AppDownloadBanner Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders download prompt on web browser", () => {
    render(<AppDownloadBanner />);
    const region = screen.getByRole("region");
    expect(region).toBeDefined();
    expect(screen.getByText(/Get the (desktop|mobile) app/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Download (desktop|mobile) app/i })).toBeDefined();
  });

  it("dismisses prompt when close button is clicked", () => {
    const onDismiss = vi.fn();
    render(<AppDownloadBanner onDismiss={onDismiss} />);
    const closeBtn = screen.getByLabelText(/Close app download banner/i);
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalled();
  });
});
