import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  CheckCircle2,
  FileKey2,
  Folder,
  FolderInput,
  HardDrive,
  LoaderCircle,
  PackageOpen,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  createArchive,
  restoreArchive,
  verifyArchive,
  type ArchiveSummary,
  type UiError,
} from "@/lib/tauri";

type View = "home" | "create" | "open";

const FALLBACK_ERROR: UiError = {
  code: "internal_failure",
  message: "SPARC could not complete the operation safely.",
  outputsMayRemain: [],
};

export default function App() {
  const [view, setView] = useState<View>("home");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--color-muted),transparent_38%)]">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Archive aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">SPARC</h1>
              <p className="text-xs text-muted-foreground">Portable archive prototype</p>
            </div>
          </div>
          <Badge variant="secondary">
            <ShieldCheck aria-hidden="true" data-icon="inline-start" />
            Local alpha
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-7 px-8 py-10">
        <Alert className="border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30">
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Prototype scope</AlertTitle>
          <AlertDescription>
            Local artifact archives only — this does not back up Supabase yet.
          </AlertDescription>
        </Alert>

        {view === "home" && <Home onSelect={setView} />}
        {view === "create" && <CreateFlow onBack={() => setView("home")} />}
        {view === "open" && <OpenFlow onBack={() => setView("home")} />}
      </main>
    </div>
  );
}

function Home({ onSelect }: { onSelect: (view: View) => void }) {
  return (
    <section aria-labelledby="home-title" className="space-y-7">
      <div className="max-w-2xl space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Encrypted local recovery</p>
        <h2 id="home-title" className="text-3xl font-semibold tracking-tight">
          What would you like to do?
        </h2>
        <p className="text-base leading-7 text-muted-foreground">
          Create a private archive from a folder, or verify and restore an archive you already
          have.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <TaskCard
          icon={<FolderInput aria-hidden="true" className="size-5" />}
          title="Create archive"
          description="Encrypt a local folder, save a separate recovery key, and verify every file."
          detail="New outputs only · Full encryption"
          onClick={() => onSelect("create")}
        />
        <TaskCard
          icon={<PackageOpen aria-hidden="true" className="size-5" />}
          title="Open archive"
          description="Check an encrypted archive and optionally restore its files to a new folder."
          detail="Verification required · Never overwrites"
          onClick={() => onSelect("open")}
        />
      </div>

      <Separator />
      <p className="text-sm leading-6 text-muted-foreground">
        Recovery keys are unencrypted private files. Keep them somewhere protected and separate
        from the archive.
      </p>
    </section>
  );
}

function TaskCard({
  icon,
  title,
  description,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="min-h-10 leading-5">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs font-medium text-muted-foreground">{detail}</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full justify-between" onClick={onClick}>
          {title}
          <ArrowRight aria-hidden="true" data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function CreateFlow({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState("");
  const [identity, setIdentity] = useState("");
  const [archive, setArchive] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ArchiveSummary>();
  const [error, setError] = useState<UiError>();
  const resultRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (summary) resultRef.current?.focus();
  }, [summary]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const clearOutcome = () => {
    setSummary(undefined);
    setError(undefined);
  };

  const chooseSource = async () => {
    const path = await open({ directory: true, multiple: false, title: "Choose source folder" });
    if (typeof path === "string") {
      setSource(path);
      clearOutcome();
    }
  };

  const chooseIdentity = async () => {
    const path = await save({
      title: "Save recovery key",
      defaultPath: "sparc-recovery.agekey",
      filters: [{ name: "SPARC recovery key", extensions: ["agekey"] }],
    });
    if (path) {
      setIdentity(path);
      clearOutcome();
    }
  };

  const chooseArchive = async () => {
    const path = await save({ title: "Choose new archive location", defaultPath: "archive.sparc" });
    if (path) {
      setArchive(path);
      clearOutcome();
    }
  };

  const create = async () => {
    if (!source || !identity || !archive || busy) return;
    clearOutcome();
    setBusy(true);
    try {
      setSummary(await createArchive({ source, archive, identity }));
    } catch (value) {
      setError(asUiError(value));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="task-title" className="space-y-6">
      <Button variant="ghost" onClick={onBack} disabled={busy}>
        <ArrowLeft aria-hidden="true" data-icon="inline-start" />
        Back
      </Button>
      <TaskHeading
        eyebrow="Create archive"
        title="Create an encrypted archive"
        description="Choose a quiet source folder, a separate recovery-key location, and a new archive path."
      />

      <Card>
        <CardHeader>
          <CardTitle>Archive locations</CardTitle>
          <CardDescription>All outputs must be new. Existing files and folders are never replaced.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <PathRow
            icon={<Folder aria-hidden="true" />}
            label="Source folder"
            value={source}
            action="Choose source folder"
            disabled={busy}
            onChoose={chooseSource}
          />
          <PathRow
            icon={<FileKey2 aria-hidden="true" />}
            label="Recovery key"
            value={identity}
            action="Save recovery key"
            disabled={busy}
            onChoose={chooseIdentity}
          />
          <PathRow
            icon={<HardDrive aria-hidden="true" />}
            label="Encrypted archive"
            value={archive}
            action="Choose archive location"
            disabled={busy}
            onChoose={chooseArchive}
          />
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Alert className="bg-background">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>The recovery key is unencrypted</AlertTitle>
            <AlertDescription>
              Save it somewhere protected and separate. Anyone with this file can open the archive;
              losing it prevents recovery.
            </AlertDescription>
          </Alert>
          <Button
            size="lg"
            onClick={create}
            disabled={!source || !identity || !archive || busy}
          >
            {busy ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                Creating…
              </>
            ) : (
              <>
                <ShieldCheck aria-hidden="true" data-icon="inline-start" />
                Create and verify archive
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {busy && (
        <p role="status" aria-live="polite" className="text-sm font-medium text-muted-foreground">
          Creating encrypted archive…
        </p>
      )}
      {summary && (
        <ResultCard
          ref={resultRef}
          label="Archive created"
          title="Archive created and verified"
          summary={summary}
        >
          <p className="break-all text-sm text-muted-foreground">{archive}</p>
          <p className="text-sm font-medium">Keep the recovery key separate from this archive.</p>
        </ResultCard>
      )}
      {error && <ErrorCard ref={errorRef} label="Archive not created" error={error} />}
    </section>
  );
}

function OpenFlow({ onBack }: { onBack: () => void }) {
  const [archive, setArchive] = useState("");
  const [identity, setIdentity] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState<"verify" | "restore">();
  const [verified, setVerified] = useState<ArchiveSummary>();
  const [restored, setRestored] = useState<ArchiveSummary>();
  const [error, setError] = useState<{ label: string; detail: UiError }>();
  const verifiedRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (verified) verifiedRef.current?.focus();
  }, [verified]);

  useEffect(() => {
    if (restored) restoredRef.current?.focus();
  }, [restored]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const invalidateVerification = () => {
    setVerified(undefined);
    setRestored(undefined);
    setDestination("");
    setError(undefined);
  };

  const chooseArchive = async () => {
    const path = await open({ directory: true, multiple: false, title: "Choose archive folder" });
    if (typeof path === "string") {
      setArchive(path);
      invalidateVerification();
    }
  };

  const chooseIdentity = async () => {
    const path = await open({
      directory: false,
      multiple: false,
      title: "Choose recovery key",
      filters: [{ name: "SPARC recovery key", extensions: ["agekey"] }],
    });
    if (typeof path === "string") {
      setIdentity(path);
      invalidateVerification();
    }
  };

  const verify = async () => {
    if (!archive || !identity || busy) return;
    setError(undefined);
    setRestored(undefined);
    setBusy("verify");
    try {
      setVerified(await verifyArchive({ archive, identity }));
    } catch (value) {
      setVerified(undefined);
      setError({ label: "Archive not verified", detail: asUiError(value) });
    } finally {
      setBusy(undefined);
    }
  };

  const chooseDestination = async () => {
    const path = await save({ title: "Choose new restore location", defaultPath: "restored-files" });
    if (path) {
      setDestination(path);
      setRestored(undefined);
      setError(undefined);
    }
  };

  const restore = async () => {
    if (!verified || !destination || busy) return;
    setError(undefined);
    setRestored(undefined);
    setBusy("restore");
    try {
      setRestored(await restoreArchive({ archive, identity, destination }));
    } catch (value) {
      setError({ label: "Files not restored", detail: asUiError(value) });
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <section aria-labelledby="task-title" className="space-y-6">
      <Button variant="ghost" onClick={onBack} disabled={Boolean(busy)}>
        <ArrowLeft aria-hidden="true" data-icon="inline-start" />
        Back
      </Button>
      <TaskHeading
        eyebrow="Verify and restore"
        title="Open an encrypted archive"
        description="Choose an archive and its recovery key. SPARC verifies every encrypted payload before restoration."
      />

      <Card>
        <CardHeader>
          <CardTitle>Archive inputs</CardTitle>
          <CardDescription>The recovery key is read locally and never sent to the interface.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <PathRow
            icon={<PackageOpen aria-hidden="true" />}
            label="Encrypted archive"
            value={archive}
            action="Choose archive folder"
            disabled={Boolean(busy)}
            onChoose={chooseArchive}
          />
          <PathRow
            icon={<FileKey2 aria-hidden="true" />}
            label="Recovery key"
            value={identity}
            action="Choose recovery key"
            disabled={Boolean(busy)}
            onChoose={chooseIdentity}
          />
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button
            size="lg"
            onClick={verify}
            disabled={!archive || !identity || Boolean(busy)}
          >
            {busy === "verify" ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                Verifying…
              </>
            ) : (
              <>
                <ShieldCheck aria-hidden="true" data-icon="inline-start" />
                Verify archive
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {busy === "verify" && (
        <p role="status" aria-live="polite" className="text-sm font-medium text-muted-foreground">
          Verifying encrypted archive…
        </p>
      )}

      {verified && (
        <ResultCard
          ref={verifiedRef}
          label="Archive verified"
          title="Archive verified"
          summary={verified}
        >
          <p className="text-sm text-muted-foreground">
            This proves the local archive bytes are intact. It does not establish Supabase recovery.
          </p>
          <Separator />
          <div className="space-y-3">
            <div>
              <p className="font-medium">Restore local files</p>
              <p className="text-sm text-muted-foreground">
                Choose a new folder path. Existing destinations are never merged or overwritten.
              </p>
            </div>
            <PathRow
              icon={<FolderInput aria-hidden="true" />}
              label="Restore location"
              value={destination}
              action="Choose restore location"
              disabled={Boolean(busy)}
              onChoose={chooseDestination}
            />
            <Button
              className="w-full"
              size="lg"
              onClick={restore}
              disabled={!destination || Boolean(busy)}
            >
              {busy === "restore" ? (
                <>
                  <LoaderCircle aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                  Restoring…
                </>
              ) : (
                <>
                  <FolderInput aria-hidden="true" data-icon="inline-start" />
                  Restore local files
                </>
              )}
            </Button>
          </div>
        </ResultCard>
      )}

      {busy === "restore" && (
        <p role="status" aria-live="polite" className="text-sm font-medium text-muted-foreground">
          Restoring verified local files…
        </p>
      )}

      {restored && (
        <ResultCard
          ref={restoredRef}
          label="Local files restored"
          title="Local files restored"
          summary={restored}
        >
          <p className="break-all text-sm text-muted-foreground">{destination}</p>
          <p className="text-sm font-medium">No Supabase project was modified.</p>
        </ResultCard>
      )}
      {error && <ErrorCard ref={errorRef} label={error.label} error={error.detail} />}
    </section>
  );
}

function TaskHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
      <h2 id="task-title" className="text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-base leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function PathRow({
  icon,
  label,
  value,
  action,
  disabled,
  onChoose,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  action: string;
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground" title={value || "Not selected"}>
          {value || "Not selected"}
        </p>
      </div>
      <Button variant="outline" onClick={onChoose} disabled={disabled}>
        {action}
      </Button>
    </div>
  );
}

const ResultCard = React.forwardRef<
  HTMLDivElement,
  {
    label: string;
    title: string;
    summary: ArchiveSummary;
    children: React.ReactNode;
  }
>(({ label, title, summary, children }, ref) => (
  <Card ref={ref} role="status" aria-label={label} tabIndex={-1} className="border-emerald-200">
    <CardHeader>
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 aria-hidden="true" className="size-5" />
        <CardTitle>{title}</CardTitle>
      </div>
      <CardDescription>Every encrypted payload passed authentication, size, and hash checks.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric value={summary.files} label={plural(summary.files, "file")} />
        <Metric value={summary.directories} label={plural(summary.directories, "directory")} />
        <Metric value={summary.plaintextBytes} label="plaintext bytes" />
        <Metric value={summary.ciphertextFiles} label="encrypted files" />
      </div>
      {children}
    </CardContent>
  </Card>
));
ResultCard.displayName = "ResultCard";

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground"> {label}</p>
    </div>
  );
}

const ErrorCard = React.forwardRef<HTMLDivElement, { label: string; error: UiError }>(
  ({ label, error }, ref) => (
    <Alert ref={ref} variant="destructive" aria-label={label} tabIndex={-1}>
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{label}</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        {error.outputsMayRemain.length > 0 && (
          <p>These outputs may remain: {error.outputsMayRemain.join(", ")}.</p>
        )}
      </AlertDescription>
    </Alert>
  ),
);
ErrorCard.displayName = "ErrorCard";

function asUiError(value: unknown): UiError {
  if (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    "message" in value &&
    typeof value.message === "string" &&
    "outputsMayRemain" in value &&
    Array.isArray(value.outputsMayRemain) &&
    value.outputsMayRemain.every((item) => typeof item === "string")
  ) {
    return value as UiError;
  }
  return FALLBACK_ERROR;
}

function plural(value: number, noun: string) {
  return `${noun}${value === 1 ? "" : "s"}`;
}
