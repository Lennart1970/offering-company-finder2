import DashboardLayout from "@/components/DashboardLayout";

const sections = [
  {
    number: "1",
    title: "Scope and Purpose",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          These Terms of Use govern access to and use of the internal sales intelligence platform ("Platform") operated by Connect Group N.V. ("Connect Group").
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">The Platform supports internal business activities, including:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
          <li>Lead identification and qualification</li>
          <li>Data enrichment and signal detection</li>
          <li>Sales prioritization and outreach support</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          Use of the Platform is strictly limited to authorized personnel within Connect Group.
        </p>
      </>
    ),
  },
  {
    number: "2",
    title: "Internal Business Use Only",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          The Platform and all associated data are provided solely for <strong>internal business purposes</strong>.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">This principle aligns with third-party licensing conditions, including those of Apollo.io.</p>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Users may not:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
          <li>Share Platform access with unauthorized individuals</li>
          <li>Distribute, transfer, or expose data outside Connect Group</li>
          <li>Use the Platform for the benefit of third parties without explicit approval</li>
        </ul>
      </>
    ),
  },
  {
    number: "3",
    title: "Third-Party Data Sources and Licensing",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          The Platform integrates and processes data from third-party providers, including but not limited to Apollo.io.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Use of such data is governed by the applicable third-party terms, including:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2 mb-3">
          <li>
            Apollo Terms of Service:{" "}
            <a href="https://www.apollo.io/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
              apollo.io/terms
            </a>
          </li>
          <li>
            Apollo API Terms of Use:{" "}
            <a href="https://www.apollo.io/terms/api" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
              apollo.io/terms/api
            </a>
          </li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Users acknowledge and agree that:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
          <li>Third-party data is <strong>licensed, not owned</strong></li>
          <li>Such data may not be <strong>redistributed, sublicensed, or resold</strong></li>
          <li>The Platform may not be used to <strong>replicate or compete with third-party services</strong>, including Apollo</li>
          <li>All use must remain within the scope of <strong>internal business purposes</strong>, as defined in applicable third-party agreements</li>
        </ul>
      </>
    ),
  },
  {
    number: "4",
    title: "Data Transformation and Proprietary Insights",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          The Platform may transform, enrich, and combine data from multiple sources to generate proprietary insights.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Permitted use includes:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2 mb-3">
          <li>Lead scoring and prioritization</li>
          <li>Market and signal analysis</li>
          <li>Sales intelligence workflows</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Users may not:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
          <li>Extract or reconstruct raw third-party datasets</li>
          <li>Export data in a form that replicates third-party databases</li>
          <li>Use Platform outputs as a standalone data product</li>
        </ul>
      </>
    ),
  },
  {
    number: "5",
    title: "Access Control and Security",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Users are responsible for:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2 mb-3">
          <li>Maintaining confidentiality of login credentials</li>
          <li>Preventing unauthorized access</li>
          <li>Reporting suspected misuse or security incidents</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed">
          Connect Group reserves the right to monitor, restrict, or revoke access at any time.
        </p>
      </>
    ),
  },
  {
    number: "6",
    title: "Data Protection and Privacy",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          All use of the Platform must comply with applicable data protection laws, including the <strong>General Data Protection Regulation (GDPR)</strong>.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Users must:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2 mb-3">
          <li>Use data only for legitimate business purposes</li>
          <li>Respect opt-outs and data subject rights</li>
          <li>Avoid misuse of personal data</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed">
          Connect Group acts as an independent data controller for its use of data within the Platform.
        </p>
      </>
    ),
  },
  {
    number: "7",
    title: "Restrictions",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Users may not:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
          <li>Use the Platform to build or distribute competing products or services</li>
          <li>Provide access to third parties</li>
          <li>Circumvent technical or contractual limitations</li>
          <li>Use the Platform in violation of applicable laws or third-party terms</li>
        </ul>
      </>
    ),
  },
  {
    number: "8",
    title: "Monitoring and Compliance",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Use of the Platform may be monitored to ensure:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2 mb-3">
          <li>Compliance with these Terms</li>
          <li>Alignment with third-party licensing conditions</li>
          <li>Responsible and lawful data usage</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed">
          Users agree to cooperate with internal compliance and audit activities when required.
        </p>
      </>
    ),
  },
  {
    number: "9",
    title: "Intellectual Property",
    content: (
      <p className="text-sm text-gray-700 leading-relaxed">
        All Platform components, including software, models, workflows, and derived insights, are the property of Connect Group, except for third-party data, which remains subject to its respective licensing terms.
      </p>
    ),
  },
  {
    number: "10",
    title: "Liability",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          The Platform is provided "as is" for internal use.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">Connect Group shall not be liable for:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
          <li>Inaccuracies in third-party data</li>
          <li>Decisions made based on Platform outputs</li>
          <li>Interruptions or limitations in availability</li>
        </ul>
      </>
    ),
  },
  {
    number: "11",
    title: "Changes to Terms",
    content: (
      <p className="text-sm text-gray-700 leading-relaxed">
        Connect Group may update these Terms from time to time. Continued use of the Platform constitutes acceptance of any updates.
      </p>
    ),
  },
  {
    number: "12",
    title: "Governing Law",
    content: (
      <p className="text-sm text-gray-700 leading-relaxed">
        These Terms shall be governed by the laws of The Netherlands.
      </p>
    ),
  },
  {
    number: "13",
    title: "Acceptance",
    content: (
      <>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">By using the Platform, users confirm that they:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
          <li>Understand and accept these Terms</li>
          <li>Will comply with all applicable rules and restrictions</li>
          <li>Will use the Platform responsibly within its intended scope</li>
        </ul>
      </>
    ),
  },
];

export default function TermsOfUse() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b-2 border-black">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">LEGAL</div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-black mb-2">Terms of Use</h1>
          <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
            <span>
              <strong className="text-black">Company:</strong>{" "}
              <a href="https://connectgroup.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Connect Group N.V.
              </a>
            </span>
            <span className="text-gray-300">|</span>
            <span><strong className="text-black">Last updated:</strong> 24 April 2026</span>
          </div>
        </div>

        {/* Intro notice */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-8">
          <p className="text-sm font-bold text-amber-800">Internal Use Only</p>
          <p className="text-xs text-amber-700 mt-1">
            This platform is operated by Connect Group N.V. exclusively for authorized internal personnel. By accessing the platform, you agree to these terms.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.number} className="border border-gray-200 rounded-none">
              {/* Section header */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-7 h-7 bg-black text-white text-xs font-black rounded-none">
                  {section.number}
                </span>
                <h2 className="text-sm font-black uppercase tracking-wide text-black">{section.title}</h2>
              </div>
              {/* Section content */}
              <div className="px-4 py-4">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t-2 border-black text-center">
          <p className="text-xs text-gray-400 font-medium">
            © {new Date().getFullYear()} Connect Group N.V. — Internal Sales Intelligence Platform
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Questions? Contact your platform administrator.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
