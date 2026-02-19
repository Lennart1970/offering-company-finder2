import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function CallToday() {
  const { user, loading: authLoading } = useAuth();
  const callTodayQuery = trpc.companyFinder.getCallToday.useQuery(undefined, {
    enabled: !!user,
  });
  const { data, isLoading } = callTodayQuery;

  // Sort by urgency score (highest first) by default
  const companies = data?.companies || [];
  const sortedCompanies = [...companies].sort((a, b) => {
    const aScore = a.company.briefData ? JSON.parse(a.company.briefData).urgencyScore : 0;
    const bScore = b.company.briefData ? JSON.parse(b.company.briefData).urgencyScore : 0;
    return bScore - aScore;
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b-4 border-black p-6">
          <div className="container flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/">
                <div className="text-2xl font-bold cursor-pointer">[CF]</div>
              </Link>
              <h1 className="text-2xl font-bold">CALL TODAY</h1>
            </div>
          </div>
        </div>
        
        <div className="container p-8">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b-4 border-black p-6">
          <div className="container flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/">
                <div className="text-2xl font-bold cursor-pointer">[CF]</div>
              </Link>
              <h1 className="text-2xl font-bold">CALL TODAY</h1>
            </div>
          </div>
        </div>
        
        <div className="container p-8">
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-4 border-black p-6">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/">
              <div className="text-2xl font-bold cursor-pointer">[CF]</div>
            </Link>
            <h1 className="text-2xl font-bold">CALL TODAY</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              {sortedCompanies.length} {sortedCompanies.length === 1 ? "COMPANY" : "COMPANIES"}
            </div>
            <Link href="/">
              <button className="px-4 py-2 border-2 border-black font-bold text-sm">
                BACK TO SEARCH
              </button>
            </Link>
            <div className="text-sm font-bold">{user.name}</div>
          </div>
        </div>
      </div>

      <div className="container p-8">
        {sortedCompanies.length === 0 ? (
          <div className="border-4 border-black p-8 text-center">
            <p className="text-xl font-bold mb-2">NO COMPANIES MARKED</p>
            <p>Mark companies as "CALL TODAY" from your search results to see them here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedCompanies.map(({ company, decision, contact }) => {
              const briefData = company.briefData ? JSON.parse(company.briefData) : null;
              const salesApproachData = company.salesApproachData
                ? JSON.parse(company.salesApproachData)
                : null;

              // Check pipeline readiness
              const hasDeepResearch = !!briefData;
              const hasSalesApproach = !!salesApproachData;
              const hasContact = !!contact;

              return (
                <div key={company.id} className="border-4 border-black">
                  {/* SECTION 1: HEADER - Who am I calling? */}
                  <div className="p-6 border-b-4 border-black bg-gray-50">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-3xl font-bold mb-2">{company.name}</h2>
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
                      
                      {/* Pipeline Readiness Indicators */}
                      <div className="flex gap-2 text-xs">
                        <div className={`px-2 py-1 border-2 ${hasDeepResearch ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-400'}`}>
                          {hasDeepResearch ? '✓' : '○'} DR
                        </div>
                        <div className={`px-2 py-1 border-2 ${hasSalesApproach ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-400'}`}>
                          {hasSalesApproach ? '✓' : '○'} SA
                        </div>
                        <div className={`px-2 py-1 border-2 ${hasContact ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-400'}`}>
                          {hasContact ? '✓' : '○'} CT
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    {contact ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-bold mb-1">CONTACT</div>
                          <div className="text-xl font-bold">{contact.fullName}</div>
                          <div className="text-sm text-gray-600">{contact.title}</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold mb-1">REACH</div>
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="text-lg font-bold underline block">
                              {contact.phone}
                            </a>
                          )}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="text-sm underline block">
                              {contact.email}
                            </a>
                          )}
                          {contact.linkedinUrl && (
                            <a
                              href={contact.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm underline block"
                            >
                              LinkedIn →
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-red-600 bg-red-50">
                        <p className="text-sm font-bold text-red-600 mb-2">⚠ NO CONTACT FOUND</p>
                        <Link href={`/?searchId=${company.searchId}&companyId=${company.id}`}>
                          <button className="px-4 py-2 bg-black text-white font-bold text-sm">
                            GO TO SEARCH → FIND CONTACT
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: BEFORE YOU DIAL - Why am I calling? */}
                  <div className="p-6 border-b-4 border-black">
                    <h3 className="text-lg font-bold mb-4">BEFORE YOU DIAL</h3>
                    
                    {briefData ? (
                      <div className="space-y-4">
                        {/* Urgency Score */}
                        <div className="p-4 border-2 border-black" style={{
                          backgroundColor: briefData.urgencyScore >= 80 ? '#fee' : 
                                         briefData.urgencyScore >= 60 ? '#ffeedd' : 
                                         briefData.urgencyScore >= 40 ? '#ffffdd' : '#f5f5f5'
                        }}>
                          <div className="flex items-baseline gap-3 mb-2">
                            <div className="text-4xl font-bold">{briefData.urgencyScore}/100</div>
                            <div className="text-sm font-bold">URGENCY SCORE</div>
                          </div>
                          {briefData.urgencyReasoning && (
                            <p className="text-sm">{briefData.urgencyReasoning}</p>
                          )}
                          
                          {/* Urgency Breakdown */}
                          {briefData.urgencyBreakdown && (
                            <div className="mt-3 pt-3 border-t-2 border-black grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="font-bold">Context</div>
                                <div>{briefData.urgencyBreakdown.contextScore || 0}/40</div>
                              </div>
                              <div>
                                <div className="font-bold">Signals</div>
                                <div>{briefData.urgencyBreakdown.signalsScore || 0}/35</div>
                              </div>
                              <div>
                                <div className="font-bold">Activity</div>
                                <div>{briefData.urgencyBreakdown.activityScore || 0}/25</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Conversation Starters */}
                        {salesApproachData?.conversationStarters && salesApproachData.conversationStarters.length > 0 && (
                          <div className="p-4 border-2 border-black bg-yellow-50">
                            <div className="text-sm font-bold mb-2">💡 CONVERSATION STARTERS</div>
                            <ul className="space-y-2 text-sm">
                              {salesApproachData.conversationStarters.map((starter: string, idx: number) => (
                                <li key={idx} className="pl-4 border-l-2 border-black">{starter}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recent Developments */}
                        {briefData.recentDevelopments && briefData.recentDevelopments.length > 0 && (
                          <div className="p-4 border-2 border-black">
                            <div className="text-sm font-bold mb-2">📰 RECENT DEVELOPMENTS</div>
                            <ul className="space-y-1 text-sm">
                              {briefData.recentDevelopments.map((dev: string, idx: number) => (
                                <li key={idx}>• {dev}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Urgency Signals */}
                        {briefData.urgencySignals && briefData.urgencySignals.length > 0 && (
                          <div className="p-4 border-2 border-black">
                            <div className="text-sm font-bold mb-2">🔔 URGENCY SIGNALS</div>
                            <ul className="space-y-2 text-sm">
                              {briefData.urgencySignals.map((signal: any, idx: number) => {
                                // Handle both string and object formats
                                const signalText = typeof signal === 'string' ? signal : (signal.description || signal.signal || '');
                                const signalSource = typeof signal === 'object' ? (signal.url || signal.source) : null;
                                const signalCategory = typeof signal === 'object' ? signal.category : null;
                                
                                return (
                                  <li key={idx} className="pl-4 border-l-2 border-black">
                                    {signalCategory && (
                                      <div className="text-xs text-gray-600 mb-1">{signalCategory}</div>
                                    )}
                                    <div className="font-bold">{signalText}</div>
                                    {signalSource && (
                                      <a href={signalSource} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                                        Source →
                                      </a>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Engagement Strategy */}
                        {salesApproachData?.engagementStrategy && (
                          <div className="p-4 border-2 border-black bg-blue-50">
                            <div className="text-sm font-bold mb-2">🎯 ENGAGEMENT STRATEGY</div>
                            
                            {salesApproachData.engagementStrategy.whyThisProspectMatters && (
                              <div className="mb-3">
                                <div className="text-xs font-bold mb-1">Why This Prospect Matters</div>
                                <p className="text-sm">{salesApproachData.engagementStrategy.whyThisProspectMatters}</p>
                              </div>
                            )}
                            
                            {salesApproachData.engagementStrategy.recommendedApproach && (
                              <div className="mb-3">
                                <div className="text-xs font-bold mb-1">Recommended Approach</div>
                                <p className="text-sm">{salesApproachData.engagementStrategy.recommendedApproach}</p>
                              </div>
                            )}
                            
                            {salesApproachData.engagementStrategy.keyTalkingPoints && salesApproachData.engagementStrategy.keyTalkingPoints.length > 0 && (
                              <div>
                                <div className="text-xs font-bold mb-1">Key Talking Points</div>
                                <ul className="space-y-1 text-sm">
                                  {salesApproachData.engagementStrategy.keyTalkingPoints.map((point: string, idx: number) => (
                                    <li key={idx}>• {point}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-red-600 bg-red-50">
                        <p className="text-sm font-bold text-red-600 mb-2">⚠ NO DEEP RESEARCH</p>
                        <Link href={`/?searchId=${company.searchId}&companyId=${company.id}`}>
                          <button className="px-4 py-2 bg-black text-white font-bold text-sm">
                            GO TO SEARCH → RUN DEEP RESEARCH
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* SECTION 3: DURING THE CALL - What do I say? */}
                  <div className="p-6 border-b-4 border-black bg-green-50">
                    <h3 className="text-lg font-bold mb-4">DURING THE CALL</h3>
                    
                    {salesApproachData?.callScript ? (
                      <div className="space-y-4">
                        {/* Opening */}
                        <div className="p-4 border-2 border-black bg-white">
                          <div className="text-xs font-bold mb-2">1. OPENING (30 seconds)</div>
                          <CopyButton text={salesApproachData.callScript.opening} />
                          <p className="text-sm whitespace-pre-wrap">{salesApproachData.callScript.opening}</p>
                        </div>

                        {/* Discovery Questions */}
                        {salesApproachData.callScript.discoveryQuestions && salesApproachData.callScript.discoveryQuestions.length > 0 && (
                          <div className="p-4 border-2 border-black bg-white">
                            <div className="text-xs font-bold mb-2">2. DISCOVERY QUESTIONS</div>
                            <CopyButton text={salesApproachData.callScript.discoveryQuestions.join('\n\n')} />
                            <ul className="space-y-2 text-sm">
                              {salesApproachData.callScript.discoveryQuestions.map((q: string, idx: number) => (
                                <li key={idx} className="pl-4 border-l-2 border-black">{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Value Proposition */}
                        {salesApproachData.callScript.valueProposition && (
                          <div className="p-4 border-2 border-black bg-white">
                            <div className="text-xs font-bold mb-2">3. VALUE PROPOSITION</div>
                            <CopyButton text={salesApproachData.callScript.valueProposition} />
                            <p className="text-sm whitespace-pre-wrap">{salesApproachData.callScript.valueProposition}</p>
                          </div>
                        )}

                        {/* Call to Action */}
                        {salesApproachData.callScript.callToAction && (
                          <div className="p-4 border-2 border-black bg-white">
                            <div className="text-xs font-bold mb-2">4. CALL TO ACTION</div>
                            <CopyButton text={salesApproachData.callScript.callToAction} />
                            <p className="text-sm whitespace-pre-wrap">{salesApproachData.callScript.callToAction}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-red-600 bg-red-50">
                        <p className="text-sm font-bold text-red-600 mb-2">⚠ NO CALL SCRIPT</p>
                        <Link href={`/?searchId=${company.searchId}&companyId=${company.id}`}>
                          <button className="px-4 py-2 bg-black text-white font-bold text-sm">
                            GO TO SEARCH → CREATE SALES APPROACH
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* SECTION 4: AFTER THE CALL - Follow-up materials */}
                  <div className="p-6 border-b-4 border-black">
                    <h3 className="text-lg font-bold mb-4">AFTER THE CALL</h3>
                    
                    {salesApproachData ? (
                      <div className="space-y-4">
                        {/* Email Draft */}
                        {salesApproachData.emailDraft && (
                          <div className="p-4 border-2 border-black">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-bold">📧 EMAIL DRAFT</div>
                              <CopyButton text={`Subject: ${salesApproachData.emailDraft.subject}\n\n${salesApproachData.emailDraft.body}`} />
                            </div>
                            <div className="text-sm font-bold mb-2">
                              Subject: {salesApproachData.emailDraft.subject}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">
                              {salesApproachData.emailDraft.body}
                            </div>
                          </div>
                        )}

                        {/* LinkedIn Messages */}
                        {salesApproachData.linkedinMessage && (
                          <div className="space-y-3">
                            {/* Connection Request */}
                            <div className="p-4 border-2 border-black">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-bold">💼 LINKEDIN CONNECTION REQUEST</div>
                                <CopyButton text={salesApproachData.linkedinMessage.connectionRequest} />
                              </div>
                              <div className="text-sm whitespace-pre-wrap">
                                {salesApproachData.linkedinMessage.connectionRequest}
                              </div>
                            </div>

                            {/* Follow-up Message */}
                            {salesApproachData.linkedinMessage.followUp && (
                              <div className="p-4 border-2 border-black">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-xs font-bold">💼 LINKEDIN FOLLOW-UP MESSAGE</div>
                                  <CopyButton text={salesApproachData.linkedinMessage.followUp} />
                                </div>
                                <div className="text-sm whitespace-pre-wrap">
                                  {salesApproachData.linkedinMessage.followUp}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-red-600 bg-red-50">
                        <p className="text-sm font-bold text-red-600 mb-2">⚠ NO SALES APPROACH</p>
                        <Link href={`/?searchId=${company.searchId}&companyId=${company.id}`}>
                          <button className="px-4 py-2 bg-black text-white font-bold text-sm">
                            GO TO SEARCH → CREATE SALES APPROACH
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* SECTION 5: COMPANY CONTEXT - Reference */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold mb-4">COMPANY CONTEXT</h3>
                    
                    <div className="space-y-4">
                      {/* Products & Services */}
                      {briefData?.productsServices && briefData.productsServices.length > 0 && (
                        <div>
                          <div className="text-xs font-bold mb-1">Products & Services</div>
                          <ul className="text-sm space-y-1">
                            {briefData.productsServices.map((item: any, idx: number) => {
                              const itemText = typeof item === 'string' ? item : (item.description || item.category || '');
                              return <li key={idx}>• {itemText}</li>;
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Key Technologies */}
                      {briefData?.keyTechnologies && briefData.keyTechnologies.length > 0 && (
                        <div>
                          <div className="text-xs font-bold mb-1">Key Technologies</div>
                          <ul className="text-sm space-y-1">
                            {briefData.keyTechnologies.map((tech: any, idx: number) => {
                              const techText = typeof tech === 'string' ? tech : (tech.description || tech.category || '');
                              return <li key={idx}>• {techText}</li>;
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Target Markets */}
                      {briefData?.targetMarkets && briefData.targetMarkets.length > 0 && (
                        <div>
                          <div className="text-xs font-bold mb-1">Target Markets</div>
                          <ul className="text-sm space-y-1">
                            {briefData.targetMarkets.map((market: any, idx: number) => {
                              const marketText = typeof market === 'string' ? market : (market.description || market.category || '');
                              return <li key={idx}>• {marketText}</li>;
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Basic Company Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t-2 border-black">
                        {company.revenue && (
                          <div>
                            <span className="font-bold">Revenue:</span> {company.revenue}
                          </div>
                        )}
                        {company.foundedYear && (
                          <div>
                            <span className="font-bold">Founded:</span> {company.foundedYear}
                          </div>
                        )}
                        {company.city && (
                          <div>
                            <span className="font-bold">Location:</span> {company.city}
                            {company.state && `, ${company.state}`}
                            {company.country && `, ${company.country}`}
                          </div>
                        )}
                        {company.linkedinUrl && (
                          <div>
                            <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline">
                              Company LinkedIn →
                            </a>
                          </div>
                        )}
                      </div>

                      {/* SIC/NAICS Codes */}
                      {(company.sicCodes || company.naicsCodes) && (
                        <div className="text-xs pt-4 border-t-2 border-black">
                          {company.sicCodes && (
                            <div className="mb-1">
                              <span className="font-bold">SIC:</span> {company.sicCodes}
                            </div>
                          )}
                          {company.naicsCodes && (
                            <div>
                              <span className="font-bold">NAICS:</span> {company.naicsCodes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: Decision Timestamp */}
                  <div className="px-6 py-3 border-t-4 border-black bg-gray-50 text-xs text-gray-600">
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

// Copy to clipboard button component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="float-right px-2 py-1 text-xs border-2 border-black font-bold"
    >
      {copied ? "✓ COPIED" : "COPY"}
    </button>
  );
}
