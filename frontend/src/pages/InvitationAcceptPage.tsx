import { useEffect, useState } from "react";
import { acceptWorkspaceInvitation } from "../services/sharing";
import { useAuthStore } from "../stores/useAuthStore";

export function InvitationAcceptPage({ token }: { token: string }) {
  const hydrateSession = useAuthStore((state) => state.hydrateSession);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const [status, setStatus] = useState("Aceitando convite...");

  useEffect(() => {
    let active = true;
    void acceptWorkspaceInvitation(token).then(async (response) => {
      if (!active) return;
      if (!response.ok) {
        setStatus("O convite expirou, foi revogado ou pertence a outro e-mail.");
        return;
      }
      await hydrateSession();
      if (active) {
        setActiveWorkspace(response.data.id);
        setStatus(`Você entrou em ${response.data.name}.`);
      }
    });
    return () => {
      active = false;
    };
  }, [hydrateSession, setActiveWorkspace, token]);

  return <main className="public-share-status"><h1>Convite do Moctes</h1><p>{status}</p><a href="/">Abrir meus cadernos</a></main>;
}
