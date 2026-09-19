import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const openMock = vi.mocked(open);
const saveMock = vi.mocked(save);

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("Create archive", () => {
  it("requires three selections and returns a bounded summary", async () => {
    const user = userEvent.setup();
    openMock.mockResolvedValueOnce("/safe/source");
    saveMock
      .mockResolvedValueOnce("/separate/recovery.agekey")
      .mockResolvedValueOnce("/safe/project.sparc");
    invokeMock.mockResolvedValueOnce({
      files: 2,
      directories: 1,
      plaintextBytes: 17,
      ciphertextFiles: 3,
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create archive" }));
    const start = screen.getByRole("button", { name: "Create and verify archive" });
    expect(start).toBeDisabled();
    expect(screen.getByText(/recovery key is unencrypted/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose source folder" }));
    await user.click(screen.getByRole("button", { name: "Save recovery key" }));
    expect(start).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Choose archive location" }));
    expect(start).toBeEnabled();
    await user.click(start);

    expect(invokeMock).toHaveBeenCalledWith("create_archive", {
      source: "/safe/source",
      archive: "/safe/project.sparc",
      identity: "/separate/recovery.agekey",
    });
    const result = await screen.findByRole("status", { name: "Archive created" });
    expect(result).toHaveFocus();
    expect(result).toHaveTextContent("2 files");
    expect(result).toHaveTextContent("1 directory");
    expect(result).toHaveTextContent("17 plaintext bytes");
    expect(result).toHaveTextContent("3 encrypted files");
    expect(result).toHaveTextContent("/safe/project.sparc");
    expect(result).toHaveTextContent(/keep the recovery key separate/i);
  });

  it("disables controls and announces creation while busy", async () => {
    const user = userEvent.setup();
    openMock.mockResolvedValueOnce("/safe/source");
    saveMock
      .mockResolvedValueOnce("/separate/recovery.agekey")
      .mockResolvedValueOnce("/safe/project.sparc");
    let finish!: (summary: unknown) => void;
    invokeMock.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create archive" }));
    await user.click(screen.getByRole("button", { name: "Choose source folder" }));
    await user.click(screen.getByRole("button", { name: "Save recovery key" }));
    await user.click(screen.getByRole("button", { name: "Choose archive location" }));
    await user.click(screen.getByRole("button", { name: "Create and verify archive" }));

    expect(screen.getByText("Creating encrypted archive…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose source folder" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save recovery key" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose archive location" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();

    finish({ files: 0, directories: 0, plaintextBytes: 0, ciphertextFiles: 1 });
    await screen.findByRole("status", { name: "Archive created" });
  });

  it("focuses safe failures and clears task state on back", async () => {
    const user = userEvent.setup();
    openMock.mockResolvedValueOnce("/safe/source");
    saveMock
      .mockResolvedValueOnce("/separate/recovery.agekey")
      .mockResolvedValueOnce("/safe/project.sparc");
    invokeMock.mockRejectedValueOnce({
      code: "filesystem_failure",
      message: "The filesystem operation failed. Check permissions and free space.",
      outputsMayRemain: ["recovery key", "partial archive"],
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create archive" }));
    await user.click(screen.getByRole("button", { name: "Choose source folder" }));
    await user.click(screen.getByRole("button", { name: "Save recovery key" }));
    await user.click(screen.getByRole("button", { name: "Choose archive location" }));
    await user.click(screen.getByRole("button", { name: "Create and verify archive" }));

    const error = await screen.findByRole("alert", { name: "Archive not created" });
    expect(error).toHaveFocus();
    expect(error).toHaveTextContent("The filesystem operation failed");
    expect(error).toHaveTextContent("recovery key");
    expect(error).toHaveTextContent("partial archive");
    expect(error).not.toHaveTextContent("stack");

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Create archive" }));
    expect(screen.queryByText("/safe/source")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create and verify archive" })).toBeDisabled();
  });
});

describe("Open archive", () => {
  it("requires verification before restoring local files", async () => {
    const user = userEvent.setup();
    openMock
      .mockResolvedValueOnce("/safe/archive.sparc")
      .mockResolvedValueOnce("/separate/recovery.agekey");
    saveMock.mockResolvedValueOnce("/safe/restored");
    const summary = { files: 2, directories: 1, plaintextBytes: 17, ciphertextFiles: 3 };
    invokeMock.mockResolvedValueOnce(summary).mockResolvedValueOnce(summary);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open archive" }));
    const verify = screen.getByRole("button", { name: "Verify archive" });
    expect(verify).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Restore local files" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose archive folder" }));
    await user.click(screen.getByRole("button", { name: "Choose recovery key" }));
    expect(verify).toBeEnabled();
    await user.click(verify);

    expect(invokeMock).toHaveBeenCalledWith("verify_archive", {
      archive: "/safe/archive.sparc",
      identity: "/separate/recovery.agekey",
    });
    const verified = await screen.findByRole("status", { name: "Archive verified" });
    expect(verified).toHaveFocus();
    expect(verified).toHaveTextContent("2 files");
    const restore = screen.getByRole("button", { name: "Restore local files" });
    expect(restore).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Choose restore location" }));
    expect(restore).toBeEnabled();
    await user.click(restore);

    expect(invokeMock).toHaveBeenLastCalledWith("restore_archive", {
      archive: "/safe/archive.sparc",
      identity: "/separate/recovery.agekey",
      destination: "/safe/restored",
    });
    const restored = await screen.findByRole("status", { name: "Local files restored" });
    expect(restored).toHaveFocus();
    expect(restored).toHaveTextContent("Local files restored");
    expect(restored).not.toHaveTextContent("Supabase restored");
    expect(restored).toHaveTextContent("/safe/restored");
  });

  it("disables selections and announces verification while busy", async () => {
    const user = userEvent.setup();
    openMock
      .mockResolvedValueOnce("/safe/archive.sparc")
      .mockResolvedValueOnce("/separate/recovery.agekey");
    let finish!: (summary: unknown) => void;
    invokeMock.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open archive" }));
    await user.click(screen.getByRole("button", { name: "Choose archive folder" }));
    await user.click(screen.getByRole("button", { name: "Choose recovery key" }));
    await user.click(screen.getByRole("button", { name: "Verify archive" }));

    expect(screen.getByText("Verifying encrypted archive…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose archive folder" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose recovery key" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();

    finish({ files: 0, directories: 0, plaintextBytes: 0, ciphertextFiles: 1 });
    await screen.findByRole("status", { name: "Archive verified" });
  });

  it("invalidates verification when an input changes", async () => {
    const user = userEvent.setup();
    openMock
      .mockResolvedValueOnce("/safe/archive.sparc")
      .mockResolvedValueOnce("/separate/recovery.agekey")
      .mockResolvedValueOnce("/separate/other.agekey");
    invokeMock.mockResolvedValueOnce({
      files: 1,
      directories: 0,
      plaintextBytes: 4,
      ciphertextFiles: 2,
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open archive" }));
    await user.click(screen.getByRole("button", { name: "Choose archive folder" }));
    await user.click(screen.getByRole("button", { name: "Choose recovery key" }));
    await user.click(screen.getByRole("button", { name: "Verify archive" }));
    await screen.findByRole("status", { name: "Archive verified" });

    await user.click(screen.getByRole("button", { name: "Choose recovery key" }));
    expect(screen.queryByRole("status", { name: "Archive verified" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore local files" })).not.toBeInTheDocument();
  });

  it("focuses wrong-key and destination errors", async () => {
    const user = userEvent.setup();
    openMock
      .mockResolvedValueOnce("/safe/archive.sparc")
      .mockResolvedValueOnce("/separate/recovery.agekey");
    invokeMock.mockRejectedValueOnce({
      code: "wrong_key_or_corrupt_archive",
      message: "The recovery key does not match, or the archive is damaged or unsupported.",
      outputsMayRemain: [],
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open archive" }));
    await user.click(screen.getByRole("button", { name: "Choose archive folder" }));
    await user.click(screen.getByRole("button", { name: "Choose recovery key" }));
    await user.click(screen.getByRole("button", { name: "Verify archive" }));

    const wrongKey = await screen.findByRole("alert", { name: "Archive not verified" });
    expect(wrongKey).toHaveFocus();
    expect(wrongKey).toHaveTextContent("recovery key does not match");
  });

  it("shows a safe restore failure after successful verification", async () => {
    const user = userEvent.setup();
    openMock
      .mockResolvedValueOnce("/safe/archive.sparc")
      .mockResolvedValueOnce("/separate/recovery.agekey");
    saveMock.mockResolvedValueOnce("/safe/existing");
    const summary = { files: 1, directories: 0, plaintextBytes: 4, ciphertextFiles: 2 };
    invokeMock.mockResolvedValueOnce(summary).mockRejectedValueOnce({
      code: "destination_exists",
      message: "Choose a new output path. SPARC never overwrites existing files or folders.",
      outputsMayRemain: [],
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open archive" }));
    await user.click(screen.getByRole("button", { name: "Choose archive folder" }));
    await user.click(screen.getByRole("button", { name: "Choose recovery key" }));
    await user.click(screen.getByRole("button", { name: "Verify archive" }));
    await screen.findByRole("status", { name: "Archive verified" });
    await user.click(screen.getByRole("button", { name: "Choose restore location" }));
    await user.click(screen.getByRole("button", { name: "Restore local files" }));

    const error = await screen.findByRole("alert", { name: "Files not restored" });
    expect(error).toHaveFocus();
    expect(error).toHaveTextContent("never overwrites existing files or folders");
  });
});
