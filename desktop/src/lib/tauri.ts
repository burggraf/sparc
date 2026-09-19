import { invoke } from "@tauri-apps/api/core";

export interface ArchiveSummary {
  files: number;
  directories: number;
  plaintextBytes: number;
  ciphertextFiles: number;
}

export interface UiError {
  code: string;
  message: string;
  outputsMayRemain: string[];
}

export function createArchive(paths: {
  source: string;
  archive: string;
  identity: string;
}): Promise<ArchiveSummary> {
  return invoke<ArchiveSummary>("create_archive", paths);
}
