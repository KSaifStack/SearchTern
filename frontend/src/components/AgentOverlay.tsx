import { useCallback, useEffect, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import {
    Robot,
    Check,
    X,
    BookmarkSimple,
    PaperPlaneTilt,
    ArrowClockwise,
} from "@phosphor-icons/react";
import { useAuth } from "./AuthContext";
import { useTracker } from "./TrackerContext";
import { makeJobFingerprint } from "../utils/jobFingerprint";
import {
    fetchPendingAgentProposals,
    decideAgentProposal,
    type AgentProposal,
} from "../api/agent";
import "../styles/AgentOverlay.css";

const TOOL_META: Record<string, { title: string; icon: React.ReactNode }> = {
    add_to_tracker: { title: "Save to tracker", icon: <BookmarkSimple size={16} weight="bold" /> },
    update_status: { title: "Update status", icon: <ArrowClockwise size={16} weight="bold" /> },
    apply: { title: "Apply for internship", icon: <PaperPlaneTilt size={16} weight="bold" /> },
};

function describe(p: AgentProposal): string {
    const { company, role, location, status } = p.payload;
    switch (p.tool) {
        case "add_to_tracker":
            return `Save ${role} at ${company}${location ? ` (${location})` : ""} to your Saved column.`;
        case "update_status":
            return `Move ${role} at ${company}${location ? ` (${location})` : ""} to "${status}".`;
        case "apply":
            return `Apply for ${role} at ${company}${location ? ` (${location})` : ""} — will be recorded as Applied in your tracker.`;
    }
}

export function AgentOverlay() {
    const { user } = useAuth();
    const { addJob, updateJobStatus, isJobTracked } = useTracker();
    const userId = user?.id ?? "";

    const [open, setOpen] = useState(false);
    const [proposals, setProposals] = useState<AgentProposal[]>([]);
    const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
    const timerRef = useRef<number | null>(null);

    const refresh = useCallback(async () => {
        if (!userId) {
            setProposals([]);
            return;
        }
        const list = await fetchPendingAgentProposals(userId);
        setProposals(list);
    }, [userId]);

    useEffect(() => {
        refresh();
        timerRef.current = window.setInterval(refresh, 8000);
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
        };
    }, [refresh]);

    const settle = useCallback(
        async (p: AgentProposal, decision: "approved" | "rejected") => {
            if (busyIds.has(p.id)) return;
            setBusyIds((prev) => new Set(prev).add(p.id));

            if (decision === "approved") {
                const { company, role, location, link, status } = p.payload;
                const loc = location ?? "";
                if (p.tool === "add_to_tracker") {
                    addJob({ company, role, location: loc, link }, "Saved");
                } else if (p.tool === "apply") {
                    if (isJobTracked(company, role, loc)) {
                        updateJobStatus(makeJobFingerprint(company, role, loc), "Applied");
                    } else {
                        addJob({ company, role, location: loc, link }, "Applied");
                    }
                } else if (p.tool === "update_status") {
                    updateJobStatus(makeJobFingerprint(company, role, loc), status as NonNullable<typeof status>);
                }
            }

            await decideAgentProposal(p.id, decision, userId);
            notifications.show({
                title: decision === "approved" ? "Agent proposal approved" : "Agent proposal rejected",
                message: describe(p),
                color: decision === "approved" ? "teal" : "red",
                icon: decision === "approved" ? <Check size={18} /> : <X size={18} />,
                autoClose: 3500,
            });
            setBusyIds((prev) => {
                const next = new Set(prev);
                next.delete(p.id);
                return next;
            });
            await refresh();
        },
        [busyIds, userId, addJob, updateJobStatus, isJobTracked, refresh]
    );

    const pending = proposals.length;

    if (!user || (pending === 0 && !open)) {
        return null;
    }

    return (
        <div className="agent-overlay">
            {open && (
                <div className="agent-panel">
                    <div className="agent-panel-header">
                        <span className="agent-panel-title">
                            <Robot size={18} weight="bold" />
                            Agent actions to review
                        </span>
                        <button className="agent-close" onClick={() => setOpen(false)} title="Close">
                            <X size={16} weight="bold" />
                        </button>
                    </div>

                    {pending === 0 ? (
                        <p className="agent-empty">No proposals waiting. When an agent proposes an action, it appears here for your approval.</p>
                    ) : (
                        <div className="agent-list">
                            {proposals.map((p) => {
                                const busy = busyIds.has(p.id);
                                const meta = TOOL_META[p.tool] ?? { title: p.tool };
                                return (
                                    <div className="agent-item" key={p.id}>
                                        <div className="agent-item-icon">{meta.icon}</div>
                                        <div className="agent-item-body">
                                            <span className="agent-item-title">{meta.title}</span>
                                            <span className="agent-item-desc">{describe(p)}</span>
                                            {p.payload.link && (
                                                <a href={p.payload.link} target="_blank" rel="noreferrer" className="agent-item-link">
                                                    {p.payload.company} listing ↗
                                                </a>
                                            )}
                                            {p.note && <span className="agent-item-note">"{p.note}"</span>}
                                        </div>
                                        <div className="agent-item-actions">
                                            <button
                                                className="agent-approve"
                                                disabled={busy}
                                                onClick={() => settle(p, "approved")}
                                                title="Approve — the action is applied to your tracker"
                                            >
                                                <Check size={18} weight="bold" />
                                            </button>
                                            <button
                                                className="agent-reject"
                                                disabled={busy}
                                                onClick={() => settle(p, "rejected")}
                                                title="Reject — nothing happens"
                                            >
                                                <X size={18} weight="bold" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <button
                className={`agent-fab${open ? " open" : ""}`}
                onClick={() => setOpen((o) => !o)}
                title="Review agent actions"
            >
                <Robot size={22} weight="fill" />
                {pending > 0 && <span className="agent-badge">{pending}</span>}
            </button>
        </div>
    );
}