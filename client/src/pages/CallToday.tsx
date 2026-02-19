import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export default function CallToday() {
  const { user, loading: authLoading } = useAuth();
  const callTodayQuery = trpc.companyFinder.getCallToday.useQuery(undefined, {
    enabled: !!user,
  });
  const { data, isLoading } = callTodayQuery;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="container">
          <h1 className="text-4xl font-bold mb-8">CALL TODAY</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="container">
          <h1 className="text-4xl font-bold mb-8">CALL TODAY</h1>
          <p className="mb-4">Please log in to view your call list.</p>
          <a
            href={getLoginUrl()}
            className="inline-block px-6 py-3 bg-black text-white font-bold"
          >
            LOG IN
          </a>
        </div>
      </div>
    );
  }

  const companies = data?.companies || [];

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="container">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">CALL TODAY</h1>
          <p className="text-lg">
            {companies.length} {companies.length === 1 ? "company" : "companies"} marked for immediate action
          </p>
        </div>

        {companies.length === 0 ? (
          <div className="border-4 border-black p-8 text-center">
            <p className="text-xl font-bold mb-2">NO COMPANIES MARKED</p>
            <p>Mark companies as "CALL TODAY" from your search results to see them here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {companies.map(({ company, decision, contact }) => {
              const briefData = company.briefData ? JSON.parse(company.briefData) : null;
              const salesApproachData = company.salesApproachData
                ? JSON.parse(company.salesApproachData)
                : null;

              return (
                <div key={company.id} className="border-4 border-black p-6">
                  {/* Company Header */}
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold mb-2">{company.name}</h2>
                    {company.websiteUrl && (
                      <a
                        href={company.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline"
                      >
                        {company.websiteUrl}
                      </a>
                    )}
                  </div>

                  {/* Urgency Score */}
                  {briefData?.urgencyScore !== undefined && (
                    <div className="mb-4 p-4 bg-gray-100 border-2 border-black">
                      <div className="text-sm font-bold mb-1">URGENCY SCORE</div>
                      <div className="text-3xl font-bold">{briefData.urgencyScore}/100</div>
                      {briefData.urgencyReasoning && (
                        <p className="text-sm mt-2">{briefData.urgencyReasoning}</p>
                      )}
                    </div>
                  )}

                  {/* Contact Info */}
                  {contact && (
                    <div className="mb-4 p-4 border-2 border-black">
                      <div className="text-sm font-bold mb-2">CONTACT</div>
                      <div className="font-bold">{contact.fullName}</div>
                      <div className="text-sm">{contact.title}</div>
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="text-sm underline block mt-1">
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-sm underline block">
                          {contact.phone}
                        </a>
                      )}
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm underline block"
                        >
                          LinkedIn Profile
                        </a>
                      )}
                    </div>
                  )}

                  {/* Sales Approach */}
                  {salesApproachData && (
                    <div className="mb-4">
                      <div className="text-sm font-bold mb-2">SALES APPROACH</div>
                      
                      {/* Email Draft */}
                      {salesApproachData.emailDraft && (
                        <div className="mb-3 p-3 border-2 border-black">
                          <div className="text-xs font-bold mb-1">EMAIL</div>
                          <div className="text-sm font-bold mb-1">
                            Subject: {salesApproachData.emailDraft.subject}
                          </div>
                          <div className="text-sm whitespace-pre-wrap">
                            {salesApproachData.emailDraft.body}
                          </div>
                        </div>
                      )}

                      {/* LinkedIn Message */}
                      {salesApproachData.linkedinMessage && (
                        <div className="mb-3 p-3 border-2 border-black">
                          <div className="text-xs font-bold mb-1">LINKEDIN</div>
                          <div className="text-sm whitespace-pre-wrap">
                            {salesApproachData.linkedinMessage.connectionRequest}
                          </div>
                        </div>
                      )}

                      {/* Call Script */}
                      {salesApproachData.callScript && (
                        <div className="p-3 border-2 border-black">
                          <div className="text-xs font-bold mb-1">CALL SCRIPT</div>
                          <div className="text-sm whitespace-pre-wrap">
                            {salesApproachData.callScript.opening}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Company Details */}
                  <div className="text-sm space-y-1">
                    {company.revenue && <div><span className="font-bold">Revenue:</span> {company.revenue}</div>}
                    {company.foundedYear && <div><span className="font-bold">Founded:</span> {company.foundedYear}</div>}
                    {company.city && (
                      <div>
                        <span className="font-bold">Location:</span> {company.city}
                        {company.state && `, ${company.state}`}
                        {company.country && `, ${company.country}`}
                      </div>
                    )}
                  </div>

                  {/* Decision Timestamp */}
                  <div className="mt-4 pt-4 border-t-2 border-black text-xs text-gray-600">
                    Marked on {new Date(decision.decidedAt).toLocaleDateString()} at{" "}
                    {new Date(decision.decidedAt).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
