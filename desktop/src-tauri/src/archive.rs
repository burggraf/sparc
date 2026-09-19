use std::{
    fs, io,
    path::Path,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveSummary {
    pub files: usize,
    pub directories: usize,
    pub plaintext_bytes: u64,
    pub ciphertext_files: usize,
}

impl From<&sparc::Manifest> for ArchiveSummary {
    fn from(manifest: &sparc::Manifest) -> Self {
        Self {
            files: manifest.artifacts.len(),
            directories: manifest.directories.len(),
            plaintext_bytes: manifest
                .artifacts
                .iter()
                .map(|artifact| artifact.bytes)
                .sum(),
            ciphertext_files: manifest.artifacts.len() + 1,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiError {
    pub code: &'static str,
    pub message: &'static str,
    pub outputs_may_remain: Vec<&'static str>,
}

impl UiError {
    fn destination_exists() -> Self {
        Self {
            code: "destination_exists",
            message: "Choose a new output path. SPARC never overwrites existing files or folders.",
            outputs_may_remain: Vec::new(),
        }
    }

    fn invalid_source() -> Self {
        Self {
            code: "invalid_input",
            message: "SPARC could not archive that source. Check that it is a stable folder containing only supported files.",
            outputs_may_remain: vec!["recovery key", "partial archive"],
        }
    }

    fn wrong_key_or_corrupt_archive() -> Self {
        Self {
            code: "wrong_key_or_corrupt_archive",
            message: "The recovery key does not match, or the archive is damaged or unsupported.",
            outputs_may_remain: Vec::new(),
        }
    }

    fn filesystem(outputs_may_remain: Vec<&'static str>) -> Self {
        Self {
            code: "filesystem_failure",
            message: "The filesystem operation failed. Check permissions and free space, then use a new output path.",
            outputs_may_remain,
        }
    }

    pub fn busy() -> Self {
        Self {
            code: "busy",
            message: "Another archive operation is already running.",
            outputs_may_remain: Vec::new(),
        }
    }

    pub fn internal(outputs_may_remain: Vec<&'static str>) -> Self {
        Self {
            code: "internal_failure",
            message: "SPARC could not complete the operation safely.",
            outputs_may_remain,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct OperationState(Arc<AtomicBool>);

impl OperationState {
    pub fn start(&self) -> Result<OperationGuard, UiError> {
        self.0
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| UiError::busy())?;
        Ok(OperationGuard(Arc::clone(&self.0)))
    }
}

#[derive(Debug)]
pub struct OperationGuard(Arc<AtomicBool>);

impl Drop for OperationGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

pub fn create_archive(
    source: &Path,
    archive: &Path,
    identity: &Path,
) -> Result<ArchiveSummary, UiError> {
    require_new(identity)?;
    require_new(archive)?;
    let recipient =
        sparc::create_identity_file(identity).map_err(|_| UiError::filesystem(vec![]))?;
    let manifest =
        sparc::pack(source, archive, &recipient).map_err(|_| UiError::invalid_source())?;
    let identity = sparc::read_identity_file(identity)
        .map_err(|_| UiError::internal(vec!["recovery key", "archive"]))?;
    let verified = sparc::verify(archive, &identity)
        .map_err(|_| UiError::internal(vec!["recovery key", "archive"]))?;
    if manifest != verified {
        return Err(UiError::internal(vec!["recovery key", "archive"]));
    }
    Ok(ArchiveSummary::from(&verified))
}

pub fn verify_archive(archive: &Path, identity: &Path) -> Result<ArchiveSummary, UiError> {
    let identity =
        sparc::read_identity_file(identity).map_err(|_| UiError::wrong_key_or_corrupt_archive())?;
    let manifest =
        sparc::verify(archive, &identity).map_err(|_| UiError::wrong_key_or_corrupt_archive())?;
    Ok(ArchiveSummary::from(&manifest))
}

pub fn restore_archive(
    archive: &Path,
    identity: &Path,
    destination: &Path,
) -> Result<ArchiveSummary, UiError> {
    require_new(destination)?;
    verify_archive(archive, identity)?;
    let identity =
        sparc::read_identity_file(identity).map_err(|_| UiError::wrong_key_or_corrupt_archive())?;
    let manifest = sparc::unpack(archive, destination, &identity)
        .map_err(|_| UiError::filesystem(vec!["partial restore"]))?;
    Ok(ArchiveSummary::from(&manifest))
}

fn require_new(path: &Path) -> Result<(), UiError> {
    match fs::symlink_metadata(path) {
        Ok(_) => Err(UiError::destination_exists()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(UiError::filesystem(Vec::new())),
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn creates_verifies_and_restores_without_the_source() {
        let work = tempfile::tempdir().unwrap();
        let source = work.path().join("source");
        let archive = work.path().join("archive");
        let identity = work.path().join("recovery.agekey");
        let restored = work.path().join("restored");
        fs::create_dir(&source).unwrap();
        fs::create_dir(source.join("empty")).unwrap();
        fs::write(source.join("data.sql"), b"-- synthetic\n").unwrap();
        fs::write(source.join("bytes.bin"), [0, 1, 2, 255]).unwrap();

        let created = create_archive(&source, &archive, &identity).unwrap();
        assert_eq!(created.files, 2);
        assert_eq!(created.directories, 1);
        assert_eq!(created.plaintext_bytes, 17);
        assert_eq!(created.ciphertext_files, 3);
        fs::remove_dir_all(&source).unwrap();

        assert_eq!(verify_archive(&archive, &identity).unwrap(), created);
        assert_eq!(
            restore_archive(&archive, &identity, &restored).unwrap(),
            created
        );
        assert_eq!(
            fs::read(restored.join("data.sql")).unwrap(),
            b"-- synthetic\n"
        );
        assert_eq!(
            fs::read(restored.join("bytes.bin")).unwrap(),
            [0, 1, 2, 255]
        );
        assert!(restored.join("empty").is_dir());
    }

    #[test]
    fn refuses_existing_outputs_without_changing_them() {
        let work = tempfile::tempdir().unwrap();
        let source = work.path().join("source");
        let archive = work.path().join("archive");
        let identity = work.path().join("recovery.agekey");
        let restored = work.path().join("restored");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("data.sql"), b"safe").unwrap();

        fs::write(&identity, b"sentinel").unwrap();
        let error = create_archive(&source, &archive, &identity).unwrap_err();
        assert_eq!(error.code, "destination_exists");
        assert_eq!(fs::read(&identity).unwrap(), b"sentinel");
        assert!(!archive.exists());
        fs::remove_file(&identity).unwrap();

        fs::create_dir(&archive).unwrap();
        let error = create_archive(&source, &archive, &identity).unwrap_err();
        assert_eq!(error.code, "destination_exists");
        assert!(!identity.exists());
        fs::remove_dir(&archive).unwrap();

        create_archive(&source, &archive, &identity).unwrap();
        fs::create_dir(&restored).unwrap();
        fs::write(restored.join("sentinel"), b"untouched").unwrap();
        let error = restore_archive(&archive, &identity, &restored).unwrap_err();
        assert_eq!(error.code, "destination_exists");
        assert_eq!(fs::read(restored.join("sentinel")).unwrap(), b"untouched");
    }

    #[test]
    fn wrong_key_and_corruption_are_safe_errors() {
        let work = tempfile::tempdir().unwrap();
        let source = work.path().join("source");
        let archive = work.path().join("archive");
        let identity = work.path().join("recovery.agekey");
        let other_identity = work.path().join("other.agekey");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("data.sql"), b"safe").unwrap();
        create_archive(&source, &archive, &identity).unwrap();
        sparc::create_identity_file(&other_identity).unwrap();

        let wrong = verify_archive(&archive, &other_identity).unwrap_err();
        assert_eq!(wrong.code, "wrong_key_or_corrupt_archive");
        let serialized = serde_json::to_string(&wrong).unwrap();
        assert!(!serialized.contains("AGE-SECRET-KEY-"));
        assert!(!serialized.contains(other_identity.to_str().unwrap()));

        let payload = archive.join("00000000.age");
        let mut bytes = fs::read(&payload).unwrap();
        bytes.truncate(bytes.len() / 2);
        fs::write(payload, bytes).unwrap();
        assert_eq!(
            verify_archive(&archive, &identity).unwrap_err().code,
            "wrong_key_or_corrupt_archive"
        );
    }

    #[test]
    fn operation_state_refuses_overlap() {
        let state = OperationState::default();
        let first = state.start().unwrap();
        assert_eq!(state.start().unwrap_err().code, "busy");
        drop(first);
        assert!(state.start().is_ok());
    }
}
