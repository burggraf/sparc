import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  FolderInput,
  PackageOpen,
  ShieldCheck,
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

type View = "home" | "create" | "open";

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

        {view === "home" ? (
          <Home onSelect={setView} />
        ) : (
          <TaskIntroduction view={view} onBack={() => setView("home")} />
        )}
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

function TaskIntroduction({ view, onBack }: { view: Exclude<View, "home">; onBack: () => void }) {
  const create = view === "create";
  return (
    <section aria-labelledby="task-title" className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft aria-hidden="true" data-icon="inline-start" />
        Back
      </Button>
      <div className="max-w-2xl space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {create ? "Create archive" : "Verify and restore"}
        </p>
        <h2 id="task-title" className="text-3xl font-semibold tracking-tight">
          {create ? "Create an encrypted archive" : "Open an encrypted archive"}
        </h2>
        <p className="text-base leading-7 text-muted-foreground">
          {create
            ? "Choose a quiet source folder, a separate recovery-key location, and a new archive path."
            : "Choose an archive and its recovery key. SPARC verifies every encrypted payload before restoration."}
        </p>
      </div>
    </section>
  );
}
