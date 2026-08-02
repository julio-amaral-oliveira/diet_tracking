import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Check, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useCreateProfile, useDeleteProfile, useRenameProfile } from "@/hooks/use-profiles";
import { useProfileContext } from "@/contexts/ProfileContext";
import type { ProfileResponse } from "@/lib/types";

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  placeholder: string;
  submitLabel: string;
  initialName: string;
  isPending: boolean;
  onSubmit: (name: string) => void;
}

function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  submitLabel,
  initialName,
  isPending,
  onSubmit,
}: NameDialogProps) {
  const [nameInput, setNameInput] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (open) {
      setNameInput(initialName);
      setAttempted(false);
    }
  }, [open, initialName]);

  const nameError =
    (attempted || nameInput.trim() !== "") && !nameInput.trim() ? "O nome é obrigatório." : "";

  const handleSubmit = () => {
    setAttempted(true);
    if (!nameInput.trim()) return;
    onSubmit(nameInput.trim());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAttempted(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Input
            placeholder={placeholder}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            aria-invalid={!!nameError}
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileSwitcher() {
  const queryClient = useQueryClient();
  const { profiles, selectedProfile, selectProfile } = useProfileContext();
  const createProfile = useCreateProfile();
  const renameProfile = useRenameProfile();
  const deleteProfile = useDeleteProfile();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const onlyOneProfile = profiles && profiles.length <= 1;

  const handleCreate = (name: string) => {
    createProfile.mutate(
      { name },
      {
        onSuccess: (profile) => {
          toast({ title: "Perfil criado!", description: `Perfil "${profile.name}" criado e selecionado.` });
          selectProfile(profile);
          setCreateOpen(false);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar o perfil.", variant: "destructive" });
        },
      }
    );
  };

  const handleRename = (name: string) => {
    if (!selectedProfile) return;
    renameProfile.mutate(
      { id: selectedProfile.id, name },
      {
        onSuccess: () => {
          toast({ title: "Perfil renomeado!" });
          setRenameOpen(false);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível renomear o perfil.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedProfile) return;
    const deletedProfile = selectedProfile;
    deleteProfile.mutate(deletedProfile.id, {
      onSuccess: () => {
        const remaining = (profiles ?? []).filter((p) => p.id !== deletedProfile.id);
        queryClient.setQueryData<ProfileResponse[]>(["profiles"], remaining);
        if (remaining.length > 0) {
          selectProfile(remaining[0]);
        }
        toast({ title: "Perfil excluído", description: "O perfil e todos os seus dados foram removidos." });
        setDeleteOpen(false);
      },
      onError: (error) => {
        toast({ title: "Erro", description: error.message || "Não foi possível excluir o perfil.", variant: "destructive" });
        setDeleteOpen(false);
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
              {selectedProfile ? initialsOf(selectedProfile.name) : <Users className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-medium">
                {selectedProfile?.name ?? "Carregando..."}
              </span>
              <span className="block text-xs text-muted-foreground">Perfil</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <div className="px-2 py-1.5 text-sm font-semibold">Perfis</div>
          {profiles?.map((profile) => (
            <DropdownMenuItem
              key={profile.id}
              onClick={() => {
                selectProfile(profile);
                toast({ title: "Perfil selecionado", description: `Agora você está no perfil "${profile.name}".` });
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                {initialsOf(profile.name)}
              </span>
              <span className="flex-1 truncate">{profile.name}</span>
              {profile.user_id === selectedProfile?.user_id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Perfil
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!selectedProfile} onClick={() => setRenameOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Renomear Perfil
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!selectedProfile || onlyOneProfile}
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Perfil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Novo Perfil"
        description="Um perfil representa uma pessoa com dieta e registros próprios."
        placeholder="Ex: João, Maria, Fulano"
        submitLabel="Criar"
        initialName=""
        isPending={createProfile.isPending}
        onSubmit={handleCreate}
      />

      <NameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Renomear Perfil"
        description="O nome é exibido no seletor de perfis."
        placeholder="Novo nome"
        submitLabel="Salvar"
        initialName={selectedProfile?.name ?? ""}
        isPending={renameProfile.isPending}
        onSubmit={handleRename}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              O perfil "{selectedProfile?.name}" e todos os seus planos de dieta e registros corporais
              serão removidos permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteProfile.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
