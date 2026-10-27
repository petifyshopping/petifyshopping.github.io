import { useCallback, useEffect, useState } from "react";
import {
  approveAccessByEmail,
  approveAccessRequest,
  getAccessTeam,
  getPendingAccessRequests,
  rejectAccessRequest,
  revokeAdmin,
} from "../../services/access.js";
import useConfirmDialog from "../../hooks/useConfirmDialog.js";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import AdminButton from "./components/AdminButton.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminState from "./components/AdminState.jsx";
import useWorkspaceAccess from "../../hooks/useWorkspaceAccess.js";

export default function TeamAccessPanel() {
  const { session } = useWorkspaceAccess();
  const [requests, setRequests] = useState([]);
  const [team, setTeam] = useState({ admins: [], sales: [] });
  const [email, setEmail] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, dialogProps } = useConfirmDialog();

  const load = useCallback(async () => {
    const [nextRequests, nextTeam] = await Promise.all([
      getPendingAccessRequests(),
      getAccessTeam(),
    ]);
    setRequests(nextRequests);
    setTeam(nextTeam);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getPendingAccessRequests(), getAccessTeam()])
      .then(([nextRequests, nextTeam]) => {
        if (!active) return;
        setRequests(nextRequests);
        setTeam(nextTeam);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Team access could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function perform(action, successMessage, actionId = "") {
    setBusyId(actionId || "form");
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(successMessage);
    } catch (actionError) {
      setError(actionError.message || "Workspace access could not be updated.");
    } finally {
      setBusyId("");
    }
  }

  async function submitApproval(event) {
    event.preventDefault();
    await perform(async () => {
      await approveAccessByEmail(email);
      setEmail("");
    }, `Approved ${email.trim()} for admin access.`);
  }

  async function approveRequest(request) {
    await perform(() => approveAccessRequest(request.id), `${request.email} approved for admin access.`, request.id);
  }

  async function rejectRequest(request) {
    if (!await confirm({
      title: "Reject this access request?",
      description: `${request.email} will not be able to enter the workspace.`,
      confirmLabel: "Reject request",
    })) return;
    await perform(() => rejectAccessRequest(request.id), `Rejected ${request.email}'s request.`, request.id);
  }

  async function removeTeamMember(member, memberRole) {
    if (memberRole === "admin" && member.user_id === session?.user?.id) {
      setError("You cannot revoke your own admin access.");
      return;
    }
    if (memberRole === "admin" && team.admins.length <= 1) {
      setError("The last remaining admin cannot be revoked.");
      return;
    }
    if (!await confirm({
      title: `Revoke ${memberRole} access?`,
      description: `${member.email} will lose ${memberRole} access immediately.`,
      confirmLabel: "Revoke access",
    })) return;
    await perform(() => revokeAdmin(member.user_id), "Admin access revoked.", member.user_id);
  }

  if (loading) return <AdminState kind="loading" description="Loading pending requests and team access..." />;

  return (
    <section className="admin-settings-block team-access" aria-labelledby="team-access-title">
      <ConfirmDialog {...dialogProps} />
      <div className="admin-settings-heading">
        <div>
          <p className="admin-eyebrow">WORKSPACE ACCESS</p>
          <h2 id="team-access-title">Team &amp; Access</h2>
        </div>
        <AdminButton onClick={() => { setLoading(true); void load().catch((loadError) => setError(loadError.message)).finally(() => setLoading(false)); }}>
          Refresh
        </AdminButton>
      </div>
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
      <form className="team-access-approve-form" onSubmit={submitApproval}>
        <label>
          Approve a pending request by email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@example.com"
            required
          />
        </label>
        <AdminButton variant="primary" type="submit" disabled={busyId !== ""}>
          {busyId === "form" ? "Approving..." : "Approve by email"}
        </AdminButton>
      </form>

      <section aria-labelledby="pending-access-title">
        <h3 id="pending-access-title">Pending requests</h3>
        {requests.length ? (
          <ul className="team-access-list">
            {requests.map((request) => (
              <li key={request.id} className="team-access-card">
                <div><strong>{request.email}</strong><small>Requested {new Date(request.requested_at).toLocaleString()}</small></div>
                <div className="admin-form-actions">
                  <AdminButton variant="primary" disabled={busyId !== ""} onClick={() => approveRequest(request)}>
                    {busyId === request.id ? "Working..." : "Approve as admin"}
                  </AdminButton>
                  <AdminButton variant="danger" disabled={busyId !== ""} onClick={() => rejectRequest(request)}>Reject</AdminButton>
                </div>
              </li>
            ))}
          </ul>
        ) : <AdminState title="No pending requests" description="New sign-up requests will appear here." />}
      </section>

      <section aria-labelledby="team-admins-title">
        <h3 id="team-admins-title">Current admins</h3>
        {team.admins.length ? (
          <ul className="team-access-list">
            {team.admins.map((member) => (
              <li key={member.user_id} className="team-access-card">
                <strong>{member.email}</strong>
                <div className="team-access-admin-actions">
                  <AdminButton
                    variant="danger"
                    disabled={busyId !== "" || member.user_id === session?.user?.id || team.admins.length <= 1}
                    title={
                      member.user_id === session?.user?.id && team.admins.length <= 1
                        ? "You cannot revoke your own access, and at least one admin must remain."
                        : member.user_id === session?.user?.id
                          ? "You cannot revoke your own admin access."
                        : team.admins.length <= 1
                          ? "At least one admin must remain."
                          : undefined
                    }
                    onClick={() => removeTeamMember(member, "admin")}
                  >
                    Revoke admin
                  </AdminButton>
                  {member.user_id === session?.user?.id && team.admins.length <= 1 && (
                    <small>You cannot revoke your own access, and at least one admin must remain.</small>
                  )}
                  {member.user_id === session?.user?.id && team.admins.length > 1 && (
                    <small>You cannot revoke your own access.</small>
                  )}
                  {team.admins.length <= 1 && member.user_id !== session?.user?.id && (
                    <small>At least one admin must remain.</small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : <AdminState title="No admin users" />}
      </section>
    </section>
  );
}
