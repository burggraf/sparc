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

export function verifyArchive(paths: {
  archive: string;
  identity: string;
}): Promise<ArchiveSummary> {
  return invoke<ArchiveSummary>("verify_archive", paths);
}

export function restoreArchive(paths: {
  archive: string;
  identity: string;
  destination: string;
}): Promise<ArchiveSummary> {
  return invoke<ArchiveSummary>("restore_archive", paths);
}
