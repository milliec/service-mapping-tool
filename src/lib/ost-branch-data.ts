// Static definitions for the named OST contribution-chain branches.
// Each branch is a thematic slice of the full ENV→SYS→BEH→AREA→OPP→SOL tree.
// Source files: public/opportunities/ost-branch-*.md

export interface OSTBet {
  id: string;
  title: string;
  type: 'local' | 'strategic' | 'enabling' | 'control';
  opportunityCodes: string[];
  movesFirst: string;
  test: string;
}

export interface OSTBranch {
  id: string;
  name: string;
  shortName: string;
  headline: string;
  primaryEnvCode: string;
  envCodes: string[];
  sysCodes: string[];
  behCodes: string[];
  soCodes: string[];
  areaCodes: string[];
  opportunityCodes: string[];
  bets: OSTBet[];
  firstExperiment: string;
  color: 'emerald' | 'blue' | 'violet' | 'amber' | 'teal' | 'sky' | 'orange' | 'rose';
}

export const OST_BRANCHES: OSTBranch[] = [
  {
    id: 'upstream-prevention',
    name: 'Upstream Prevention & Policy Learning',
    shortName: 'Upstream Prevention',
    headline: 'EPR becomes a design-time signal and a policy-learning system — producers make lower-waste decisions before packaging is committed, and policy teams can see whether incentives are working.',
    primaryEnvCode: 'ENV-01',
    envCodes: ['ENV-01', 'ENV-02'],
    sysCodes: ['SYS-01', 'SYS-02', 'SYS-03', 'SYS-06'],
    behCodes: ['BEH-01', 'BEH-05'],
    soCodes: ['SO-01', 'SO-03'],
    areaCodes: ['AREA-A', 'AREA-I', 'AREA-H', 'AREA-D'],
    opportunityCodes: ['A1', 'A2', 'A3', 'A4', 'I1', 'I2', 'I3', 'I4', 'I5', 'D3', 'D4', 'H2', 'H5'],
    bets: [
      { id: 'up-1', title: 'Design-time packaging scenario tool', type: 'strategic', opportunityCodes: ['I3', 'A1', 'H2'], movesFirst: 'Packaging choices before design lock-in', test: 'Can producers compare 3 packaging options and explain fee/environment trade-offs?' },
      { id: 'up-2', title: 'Forward fee visibility calculator', type: 'strategic', opportunityCodes: ['H2', 'I1', 'A1'], movesFirst: 'Design-time fee signal before commitments', test: 'Can producers see fee consequences during design, not just at submission?' },
      { id: 'up-3', title: 'Material-switching risk analysis', type: 'control', opportunityCodes: ['A2', 'A3', 'I2'], movesFirst: 'Policy confidence in charging rationale', test: 'Do current fee signals plausibly make worse material choices cheaper?' },
      { id: 'up-4', title: 'Reuse/refill transition pathway', type: 'strategic', opportunityCodes: ['A4', 'I4'], movesFirst: 'Transition to lower-waste packaging models', test: 'Do producers know what operational changes block reuse/refill adoption?' },
      { id: 'up-5', title: 'Policy evaluation dataset for upstream design signals', type: 'enabling', opportunityCodes: ['I5', 'D3', 'H5'], movesFirst: 'Evidence that EPR changes packaging decisions', test: 'Can policy teams answer: are producers changing packaging after fee or rule changes?' },
    ],
    firstExperiment: 'Design-time packaging scenario prototype with policy, PayCal, Submit Data, and producer participants.',
    color: 'emerald',
  },

  {
    id: 'area-h-policy',
    name: 'Area H — Policy Simplification',
    shortName: 'Policy Simplification',
    headline: 'Producers make lower-waste packaging decisions before design choices are locked in, because EPR policy and charging is simpler, fairer, and visible earlier.',
    primaryEnvCode: 'ENV-01',
    envCodes: ['ENV-01', 'ENV-02'],
    sysCodes: ['SYS-01', 'SYS-02', 'SYS-03', 'SYS-06'],
    behCodes: ['BEH-01', 'BEH-05'],
    soCodes: ['SO-01', 'SO-03', 'SO-06'],
    areaCodes: ['AREA-H'],
    opportunityCodes: ['H1', 'H2', 'H3', 'H4', 'H5'],
    bets: [
      { id: 'ah-1', title: 'Forward fee visibility while packaging is being designed', type: 'strategic', opportunityCodes: ['H2'], movesFirst: 'BEH-01: producers choose packaging with clear consequences', test: 'Can producers compare packaging options before design lock-in?' },
      { id: 'ah-2', title: 'Complexity-based segmentation of support and charging', type: 'strategic', opportunityCodes: ['H3', 'H4'], movesFirst: 'SYS-06: proportionate routes for different actor types', test: 'Do producer segments predict burden, support need, and environmental leverage better than large/small categories?' },
      { id: 'ah-3', title: 'Policy simplification — remove rules that add burden without policy value', type: 'strategic', opportunityCodes: ['H1', 'H4'], movesFirst: 'SYS-02: rules understood consistently', test: 'Which EPR rules create high burden but low policy or environmental value?' },
      { id: 'ah-4', title: 'Real packaging and registration data for policy decisions', type: 'enabling', opportunityCodes: ['H5'], movesFirst: 'BEH-05: policy teams use explicit evidence questions', test: 'Can policy teams use live data to identify burden, risk, and leverage points?' },
    ],
    firstExperiment: 'Product/policy workshop using Area H branch to ask: are we helping users understand a complex system, or using evidence to make the system less complex?',
    color: 'amber',
  },

  {
    id: 'obligations-classification',
    name: 'Obligations, Classification & Fees',
    shortName: 'Obligations & Fees',
    headline: 'Users identify the right obligation, route, classification, and fee consequence first time — before errors become poor data, wrong fees, or compliance gaps.',
    primaryEnvCode: 'ENV-02',
    envCodes: ['ENV-01', 'ENV-02', 'ENV-03'],
    sysCodes: ['SYS-02', 'SYS-03', 'SYS-05', 'SYS-06'],
    behCodes: ['BEH-02', 'BEH-06'],
    soCodes: ['SO-01', 'SO-02'],
    areaCodes: ['AREA-B', 'AREA-C'],
    opportunityCodes: ['B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4'],
    bets: [
      { id: 'oc-1', title: 'Refined registration checker', type: 'local', opportunityCodes: ['B1', 'B2', 'C3'], movesFirst: 'Obligation routing and comprehension', test: 'Can users explain why an obligation applies, not just get a result?' },
      { id: 'oc-2', title: 'Activity-based guidance with sector examples', type: 'local', opportunityCodes: ['B2', 'C3'], movesFirst: 'Comprehension, support reduction', test: 'Does guidance reduce mistakes, or only explain unavoidable complexity?' },
      { id: 'oc-3', title: 'Reference data and classification tools', type: 'enabling', opportunityCodes: ['B4', 'C1'], movesFirst: 'Classification accuracy and reusable rules', test: 'Can users classify edge cases using the same reference data as the service?' },
      { id: 'oc-4', title: 'Validation and upload pre-checks', type: 'local', opportunityCodes: ['C1', 'C3'], movesFirst: 'Error correction, fewer resubmissions', test: 'Can users fix errors without support escalation?' },
      { id: 'oc-5', title: 'Fee breakdown and charge explanation', type: 'strategic', opportunityCodes: ['C2'], movesFirst: 'Fee comprehension, trust, planning', test: 'Can users explain what drove a charge and what could change it next time?' },
      { id: 'oc-6', title: 'Organisation record and delegation model', type: 'enabling', opportunityCodes: ['B3', 'C4'], movesFirst: 'Responsibility, authority, accountability', test: 'Can ownership and correction responsibility be resolved without manual support?' },
    ],
    firstExperiment: 'Obligation checker tree test with mixed-role users choosing the correct route without reading long guidance.',
    color: 'blue',
  },

  {
    id: 'trusted-data',
    name: 'Trusted Reusable Data',
    shortName: 'Reusable Data',
    headline: 'Policy, reporting, regulatory, and analyst users answer explicit accountability and behaviour-change questions from trusted reusable data instead of bespoke spreadsheets.',
    primaryEnvCode: 'ENV-02',
    envCodes: ['ENV-01', 'ENV-02', 'ENV-03'],
    sysCodes: ['SYS-03', 'SYS-05'],
    behCodes: ['BEH-04', 'BEH-05'],
    soCodes: ['SO-03'],
    areaCodes: ['AREA-D', 'AREA-C', 'AREA-H', 'AREA-I'],
    opportunityCodes: ['D1', 'D2', 'D3', 'D4'],
    bets: [
      { id: 'td-1', title: 'Question-led data mart for policy evaluation', type: 'enabling', opportunityCodes: ['D1', 'D3'], movesFirst: 'Reduction in bespoke extracts; reuse of standard datasets', test: 'Can a priority policy question be answered without one-off spreadsheet reconstruction?' },
      { id: 'td-2', title: 'Submission timeline with amendment reasons', type: 'control', opportunityCodes: ['D2'], movesFirst: 'Time to reconstruct history; amendment lineage completeness', test: 'Can current data reconstruct a defensible amendment timeline?' },
      { id: 'td-3', title: 'Field-value audit mapped to policy questions', type: 'control', opportunityCodes: ['D4', 'D3'], movesFirst: 'Fields mapped to decisions; reduced user burden', test: 'Can teams tie each collected field to an explicit decision or evidence need?' },
      { id: 'td-4', title: 'Shared data dictionary and quality scorecard', type: 'enabling', opportunityCodes: ['D1', 'D3'], movesFirst: 'Shared definitions; fewer interpretation queries', test: 'Do shared definitions reduce interpretation differences between teams?' },
    ],
    firstExperiment: 'Manual reusable extract for one policy question: can analysts answer a priority question faster with quality flags and lineage?',
    color: 'teal',
  },

  {
    id: 'ecosystem-adoption',
    name: 'Ecosystem Adoption & Stability',
    shortName: 'Ecosystem Adoption',
    headline: 'Different actor types adopt service and policy changes through stable, proportionate routes that reduce avoidable support demand, shallow compliance, and innovation lock-in.',
    primaryEnvCode: 'ENV-02',
    envCodes: ['ENV-01', 'ENV-02', 'ENV-03'],
    sysCodes: ['SYS-06'],
    behCodes: ['BEH-06'],
    soCodes: ['SO-06', 'SO-01'],
    areaCodes: ['AREA-G', 'AREA-B', 'AREA-J'],
    opportunityCodes: ['G1', 'G2', 'G3', 'G4'],
    bets: [
      { id: 'ea-1', title: 'Personalised change-impact summary by role and obligation', type: 'strategic', opportunityCodes: ['G1'], movesFirst: 'Update comprehension; time to action; support contacts', test: 'Can users identify what changed and what they need to do next?' },
      { id: 'ea-2', title: 'Change-impact preview before altering packaging or data', type: 'strategic', opportunityCodes: ['G2'], movesFirst: 'Perceived risk of change; change preview use', test: 'Do producers feel safer changing packaging or data practices between cycles?' },
      { id: 'ea-3', title: 'Low-digital or assisted compliance route', type: 'local', opportunityCodes: ['G3'], movesFirst: 'Completion rate by actor type; route time and error rate', test: 'Can smaller operators complete the core obligation with less support?' },
      { id: 'ea-4', title: 'Shared source for developer and helpdesk release notes', type: 'enabling', opportunityCodes: ['G4'], movesFirst: 'Time to publish updates; conflicting answers', test: 'Does one change source reduce conflicting support answers?' },
    ],
    firstExperiment: 'Personalised change-impact prototype + support theme analysis — test both sides of the adoption problem in parallel.',
    color: 'sky',
  },

  {
    id: 'stage-3-placement',
    name: 'Stage 3 — Placement on Market',
    shortName: 'Placement on Market',
    headline: 'Producers, schemes, and consultants classify packaging correctly, submit valid data, understand fee consequences, and maintain compliance status with less rework and interpretation burden.',
    primaryEnvCode: 'ENV-02',
    envCodes: ['ENV-01', 'ENV-02', 'ENV-03'],
    sysCodes: ['SYS-02', 'SYS-03', 'SYS-05', 'SYS-06'],
    behCodes: ['BEH-02', 'BEH-04', 'BEH-06'],
    soCodes: ['SO-01', 'SO-02', 'SO-03', 'SO-05'],
    areaCodes: ['AREA-B', 'AREA-C', 'AREA-H'],
    opportunityCodes: ['B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'H1', 'H2', 'H3'],
    bets: [
      { id: 'st3-1', title: 'Obligation checker (route + threshold + scheme/direct)', type: 'local', opportunityCodes: ['B1', 'B2', 'C3'], movesFirst: 'Correct route selection; avoidable support contacts', test: 'Do mixed-role users choose the correct route without reading long guidance?' },
      { id: 'st3-2', title: 'Scenario-led classification assistant', type: 'local', opportunityCodes: ['B4', 'C1'], movesFirst: 'Classification correctness; first-time accuracy', test: 'Can producers classify household/non-household, nation-of-sale, and RAM scenarios correctly?' },
      { id: 'st3-3', title: 'Upload pre-check report with grouped errors and example fixes', type: 'local', opportunityCodes: ['C1', 'C3'], movesFirst: 'File accepted at entry; support escalation rate', test: 'Can users fix common upload errors without helpdesk support?' },
      { id: 'st3-4', title: 'Fee breakdown view with charge drivers and assumptions', type: 'strategic', opportunityCodes: ['C2', 'H2'], movesFirst: 'Fee-basis comprehension; avoidable disputes', test: 'Can producers explain why a charge changed and what source data drove it?' },
      { id: 'st3-5', title: 'Compliance status timeline across reporting cycles', type: 'control', opportunityCodes: ['B3', 'C4'], movesFirst: 'Completion status visibility; manual chase volume', test: 'Can producers and regulators see what is complete, overdue, missing, paid, and delegated?' },
    ],
    firstExperiment: 'Validation and classification edge-case prototype — strongest product-team fit and easiest KPI baselining.',
    color: 'violet',
  },

  {
    id: 'operational-control',
    name: 'Operational Control & Regulator View',
    shortName: 'Operational Control',
    headline: 'Operational teams see compliance and risk status early enough to intervene before gaps become persistent risk — without rebuilding authority, evidence, payment, and case history from spreadsheets.',
    primaryEnvCode: 'ENV-03',
    envCodes: ['ENV-02', 'ENV-03'],
    sysCodes: ['SYS-02', 'SYS-03', 'SYS-05', 'SYS-06'],
    behCodes: ['BEH-04', 'BEH-06'],
    soCodes: ['SO-03', 'SO-04', 'SO-05'],
    areaCodes: ['AREA-J', 'AREA-F', 'AREA-D'],
    opportunityCodes: ['J1', 'J2', 'J3', 'J4', 'J5', 'D1', 'D2', 'F1', 'F2'],
    bets: [
      { id: 'oc-r1', title: 'Defra ID, organisation record, and delegation model', type: 'enabling', opportunityCodes: ['J1', 'B3'], movesFirst: 'Authority, responsibility, accountability visible', test: 'Can a regulator see who can act, who is liable, and who changed what without manual reconstruction?' },
      { id: 'oc-r2', title: 'Compliance status queue with contact confidence and next action', type: 'control', opportunityCodes: ['J2', 'F1'], movesFirst: 'Manual chase volume; missing submission resolution time', test: 'Can operational teams prioritise missing or incomplete submissions faster?' },
      { id: 'oc-r3', title: 'Evidence and payment reconciliation dashboard', type: 'control', opportunityCodes: ['J3', 'D1'], movesFirst: 'Reconciliation exceptions; evidence records reconciled without manual intervention', test: 'Does one view reduce mismatched evidence, fees, and payment follow-up?' },
      { id: 'oc-r4', title: 'Accreditation lifecycle tracker with renewal milestones', type: 'control', opportunityCodes: ['J4', 'F2'], movesFirst: 'Case history completeness; handover quality', test: 'Can caseworkers reconstruct decisions and evidence without informal notes?' },
      { id: 'oc-r5', title: 'Permit and capacity-limit checks inside regulator workflows', type: 'control', opportunityCodes: ['J5'], movesFirst: 'Permit/capacity exceptions surfaced; lookup time', test: 'Can checks be completed and recorded inside the workflow?' },
    ],
    firstExperiment: 'Compliance status queue prototype — clear operational users, measurable baseline pain, and strong contribution to both circularity assurance and waste-crime prevention.',
    color: 'orange',
  },

  {
    id: 'risk-enforcement',
    name: 'Risk Detection & Enforcement',
    shortName: 'Risk & Enforcement',
    headline: 'Regulators detect suspicious activity, check legitimacy, investigate anomalies, and maintain defensible enforcement records without manually rebuilding context from spreadsheets.',
    primaryEnvCode: 'ENV-03',
    envCodes: ['ENV-02', 'ENV-03'],
    sysCodes: ['SYS-05'],
    behCodes: ['BEH-04'],
    soCodes: ['SO-03', 'SO-05'],
    areaCodes: ['AREA-F', 'AREA-D', 'AREA-E', 'AREA-J'],
    opportunityCodes: ['F1', 'F2', 'F3', 'F4', 'D2', 'E4', 'J5'],
    bets: [
      { id: 're-1', title: 'Risk queue combining movement, submission, permit, and behaviour signals', type: 'control', opportunityCodes: ['F1', 'E1'], movesFirst: 'Time to identify high-risk cases; queue action rate', test: 'Can regulators triage cases faster with visible signal reasons?' },
      { id: 're-2', title: 'Case timeline linked to organisations, sites, movements, and evidence', type: 'control', opportunityCodes: ['F2', 'D2'], movesFirst: 'Time to assemble case context; case history completeness', test: 'Does a shared timeline improve investigation handover and decision confidence?' },
      { id: 're-3', title: 'Integrated permit and registration lookup inside regulator workflows', type: 'enabling', opportunityCodes: ['F3', 'J5'], movesFirst: 'Lookup time; checks recorded; missed legitimacy decisions', test: 'Does integrated lookup reduce manual lookup time and recording gaps?' },
      { id: 're-4', title: 'Export document checklist with missing-evidence status', type: 'control', opportunityCodes: ['F4', 'E4'], movesFirst: 'Missing document rate; overdue confirmation rate', test: 'Does document status visibility reduce missed or late follow-up?' },
    ],
    firstExperiment: 'Static risk queue prototype using a small number of known signals and real regulator scenarios — tests triage improvement before investing in automated anomaly detection.',
    color: 'rose',
  },
];

export const BRANCH_COLOR_MAP: Record<OSTBranch['color'], {
  bg: string; border: string; text: string; badge: string; dim: string; line: string;
}> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', dim: 'opacity-20', line: '#6ee7b7' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-300',    text: 'text-blue-800',    badge: 'bg-blue-100 text-blue-700',    dim: 'opacity-20', line: '#93c5fd' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-300',  text: 'text-violet-800',  badge: 'bg-violet-100 text-violet-700', dim: 'opacity-20', line: '#c4b5fd' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-800',   badge: 'bg-amber-100 text-amber-700',  dim: 'opacity-20', line: '#fcd34d' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-300',    text: 'text-teal-800',    badge: 'bg-teal-100 text-teal-700',   dim: 'opacity-20', line: '#5eead4' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-300',     text: 'text-sky-800',     badge: 'bg-sky-100 text-sky-700',     dim: 'opacity-20', line: '#7dd3fc' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-800',  badge: 'bg-orange-100 text-orange-700', dim: 'opacity-20', line: '#fdba74' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-300',    text: 'text-rose-800',    badge: 'bg-rose-100 text-rose-700',   dim: 'opacity-20', line: '#fda4af' },
};
