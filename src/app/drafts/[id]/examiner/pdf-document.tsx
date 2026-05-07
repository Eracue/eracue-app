import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  ai_model_used: string | null;
  prompt_hash: string | null;
  status: string;
  submitted_at: string;
  speaker_id: string;
  campaign_id: string | null;
  users: { name: string; title: string | null; email: string | null } | null;
  campaigns: { name: string } | null;
};

type ActionRow = {
  id: string;
  action_type: string;
  actor_kind: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  rules_active: string[] | null;
  model_version: string | null;
  occurred_at: string;
  row_hash: string;
};

type RuleRow = {
  id: string;
  name: string;
  rule_type: string;
  description: string;
  effective_from: string;
  effective_to: string | null;
};

type Props = {
  draft: DraftRow;
  actions: ActionRow[];
  rules: RuleRow[];
  actors: Record<string, { name: string; title: string | null }>;
};

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#171717",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#171717",
    paddingBottom: 12,
    marginBottom: 20,
  },
  recordLabel: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: "#737373",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: "normal",
    marginBottom: 4,
  },
  draftId: {
    fontSize: 10,
    color: "#525252",
    fontFamily: "Courier",
  },
  generated: {
    fontSize: 8,
    color: "#737373",
    marginTop: 6,
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1.2,
    color: "#404040",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 4,
    marginBottom: 8,
    marginTop: 14,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: "30%",
    color: "#737373",
    fontSize: 9,
  },
  value: {
    width: "70%",
    color: "#171717",
    fontSize: 9,
  },
  valueMono: {
    width: "70%",
    color: "#171717",
    fontSize: 9,
    fontFamily: "Courier",
  },
  draftBox: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    backgroundColor: "#fafafa",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#171717",
  },
  ruleCard: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 8,
    marginBottom: 6,
  },
  ruleName: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#171717",
    marginBottom: 2,
  },
  ruleType: {
    fontSize: 7,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  ruleDesc: {
    fontSize: 9,
    color: "#404040",
    marginBottom: 3,
  },
  ruleMeta: {
    fontSize: 7,
    color: "#737373",
    fontFamily: "Courier",
  },
  actionCard: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 8,
    marginBottom: 6,
  },
  actionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#171717",
  },
  actionTime: {
    fontSize: 8,
    color: "#737373",
    fontFamily: "Courier",
  },
  payload: {
    fontSize: 8,
    fontFamily: "Courier",
    color: "#404040",
    marginTop: 3,
    marginBottom: 3,
  },
  hash: {
    fontSize: 7,
    fontFamily: "Courier",
    color: "#737373",
    marginTop: 3,
  },
  footer: {
    borderTopWidth: 2,
    borderTopColor: "#171717",
    paddingTop: 8,
    marginTop: 16,
    fontSize: 8,
    color: "#737373",
  },
  footerLine: {
    marginBottom: 2,
  },
});

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
}

function shortHash(h: string | null | undefined): string {
  if (!h) return "—";
  if (h.length <= 16) return h;
  return h.slice(0, 8) + "..." + h.slice(-8);
}

export function ExaminerPdf({ draft, actions, rules, actors }: Props) {
  const generatedAt = new Date().toISOString();
  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.recordLabel}>Communication Record</Text>
          <Text style={styles.recordTitle}>ERA CUE Communication Record</Text>
          <Text style={styles.draftId}>Draft ID: {draft.id}</Text>
          <Text style={styles.generated}>Generated: {fmtTime(generatedAt)}</Text>
        </View>

        {/* Section 1 */}
        <Text style={styles.sectionHeader}>1. Speaker & Submission</Text>
        <View>
          <View style={styles.row}>
            <Text style={styles.label}>Speaker</Text>
            <Text style={styles.value}>{(draft.users?.name || "—") + (draft.users?.title ? ` (${draft.users.title})` : "")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{draft.users?.email || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Channel</Text>
            <Text style={styles.value}>{draft.channel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Campaign</Text>
            <Text style={styles.value}>{draft.campaigns?.name || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Source origin</Text>
            <Text style={styles.value}>{draft.source_origin.replace("_", " ")}</Text>
          </View>
          {draft.ai_model_used ? (
            <View style={styles.row}>
              <Text style={styles.label}>AI model used</Text>
              <Text style={styles.valueMono}>{draft.ai_model_used}</Text>
            </View>
          ) : null}
          {draft.prompt_hash ? (
            <View style={styles.row}>
              <Text style={styles.label}>Prompt hash (SHA-256)</Text>
              <Text style={styles.valueMono}>{shortHash(draft.prompt_hash)}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Submitted at</Text>
            <Text style={styles.valueMono}>{fmtTime(draft.submitted_at)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Final status</Text>
            <Text style={styles.value}>{draft.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Section 2 */}
        <Text style={styles.sectionHeader}>2. Draft Text (verbatim)</Text>
        <View style={styles.draftBox}>
          <Text>{draft.draft_text}</Text>
        </View>

        {/* Section 3 */}
        <Text style={styles.sectionHeader}>3. Governance Rules Active at Submission</Text>
        {rules.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#737373" }}>No rule snapshots recorded.</Text>
        ) : (
          rules.map((r) => (
            <View key={r.id} style={styles.ruleCard} wrap={false}>
              <Text style={styles.ruleName}>{r.name}</Text>
              <Text style={styles.ruleType}>{r.rule_type}</Text>
              <Text style={styles.ruleDesc}>{r.description}</Text>
              <Text style={styles.ruleMeta}>
                Effective {fmtTime(r.effective_from)}
                {r.effective_to ? ` — ${fmtTime(r.effective_to)}` : " — open"}
              </Text>
              <Text style={styles.ruleMeta}>Rule ID: {r.id}</Text>
            </View>
          ))
        )}

        {/* Section 4 */}
        <Text style={styles.sectionHeader}>4. Audit Trail (Append-Only)</Text>
        <Text style={{ fontSize: 8, color: "#737373", marginBottom: 6 }}>
          Each entry below was written with a SHA-256 row hash computed at insert. The actions table refuses UPDATE/DELETE at the database level.
        </Text>
        {actions.map((a, idx) => {
          const actorLabel = a.actor_kind === "user" && a.actor_id && actors[a.actor_id]
            ? actors[a.actor_id].name + (actors[a.actor_id].title ? ` (${actors[a.actor_id].title})` : "")
            : a.actor_kind;
          return (
            <View key={a.id} style={styles.actionCard} wrap={false}>
              <View style={styles.actionHeader}>
                <Text style={styles.actionTitle}>#{idx + 1}  {a.action_type.replace(/_/g, " ")}</Text>
                <Text style={styles.actionTime}>{fmtTime(a.occurred_at)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Actor</Text>
                <Text style={styles.value}>{actorLabel}</Text>
              </View>
              {a.model_version ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Model version</Text>
                  <Text style={styles.valueMono}>{a.model_version}</Text>
                </View>
              ) : null}
              <Text style={[styles.label, { width: "100%", marginTop: 4 }]}>Payload</Text>
              <Text style={styles.payload}>{JSON.stringify(a.payload, null, 2)}</Text>
              <Text style={styles.hash}>Row hash (SHA-256): {a.row_hash}</Text>
              <Text style={styles.hash}>Action ID: {a.id}</Text>
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLine}>Generated by ERA CUE on {fmtTime(generatedAt)}.</Text>
          <Text style={styles.footerLine}>All hashes are SHA-256 computed at the time of database insert. The actions table is append-only — UPDATE and DELETE are rejected at the database level.</Text>
          <Text style={[styles.footerLine, { fontFamily: "Courier" }]}>end of record · draft {draft.id}</Text>
        </View>
      </Page>
    </Document>
  );
}
