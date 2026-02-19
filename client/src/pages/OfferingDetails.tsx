import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function OfferingDetails() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl font-black">LOADING</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b-8 border-black p-8">
        <div className="container flex justify-between items-center">
          <h1 className="text-5xl md:text-7xl font-black leading-none">[CF]</h1>
          <div className="text-right">
            <div className="text-sm font-bold mb-2">{user?.name || user?.email}</div>
            <Button onClick={() => (window.location.href = "/")} variant="ghost" className="text-xs font-bold underline">
              RESET
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-16">
        <div className="max-w-4xl">
          {/* Page Title */}
          <div className="mb-16">
            <h2 className="text-[8vw] md:text-8xl font-black leading-none mb-4">
              OFFERING
              <br />
              DETAILS
            </h2>
            <div className="border-l-8 border-black pl-8">
              <p className="text-xl md:text-2xl font-bold text-muted-foreground">
                Review the offering you're searching for
              </p>
            </div>
          </div>

          {/* Offering Information */}
          <div className="space-y-12">
            {/* Offering Name & Description */}
            <div className="p-8 border-4 border-black bg-white">
              <div className="text-sm font-black mb-2 text-muted-foreground">[OFFERING]</div>
              <h3 className="text-4xl font-black mb-6">Electronics Manufacturing Services (EMS)</h3>
              
              <div className="mb-8">
                <div className="text-sm font-black mb-2 text-muted-foreground">[DESCRIPTION]</div>
                <p className="text-lg font-bold leading-relaxed">
                  Full-service EMS subcontractor providing PCB Assembly, Cable Assembly, Module Building, and Design to Product services. With 33 years of industrial experience and 9 locations across 8 countries, ConnectGroup supports companies from design to successful product with focus on efficiency, quality, and shorter time-to-market.
                </p>
              </div>

              <div className="mb-8">
                <div className="text-sm font-black mb-2 text-muted-foreground">[CORE SERVICES]</div>
                <div className="flex flex-wrap gap-3">
                  {["PCB Assembly", "Cable Assembly", "Module Building", "Design to Product"].map((service) => (
                    <div key={service} className="px-4 py-2 border-2 border-black font-bold">
                      {service}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Target Markets */}
            <div className="p-8 border-4 border-black bg-gray-50">
              <div className="text-sm font-black mb-4 text-muted-foreground">[TARGET MARKETS]</div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-black mb-3 text-lg">PRIMARY MARKETS</h4>
                  <ul className="space-y-2">
                    {[
                      "Railway",
                      "Healthcare/MedTech",
                      "Infrastructure",
                      "Automotive & Off-road",
                      "Defense & Avionics",
                      "Industrial Manufacturing"
                    ].map((market) => (
                      <li key={market} className="font-bold flex items-start gap-2">
                        <span className="text-black font-black">▪</span>
                        <span>{market}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-black mb-3 text-lg">SECONDARY MARKETS</h4>
                  <ul className="space-y-2">
                    {[
                      "Electronics",
                      "Telecommunications",
                      "Energy",
                      "Automation",
                      "Instrumentation",
                      "Aerospace"
                    ].map((market) => (
                      <li key={market} className="font-bold flex items-start gap-2">
                        <span className="text-black font-black">▪</span>
                        <span>{market}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t-2 border-black">
                <h4 className="font-black mb-3 text-lg">ADDITIONAL MARKETS</h4>
                <p className="font-bold leading-relaxed">
                  Marine • Agricultural Equipment • Construction Equipment • Mining • Oil & Gas • Renewable Energy • IoT • Embedded Systems
                </p>
              </div>
            </div>

            {/* Offering Keywords */}
            <div className="p-8 border-4 border-black bg-white">
              <div className="text-sm font-black mb-4 text-muted-foreground">[OFFERING KEYWORDS]</div>
              <p className="text-sm font-bold mb-4 text-muted-foreground">
                These keywords are used to find companies matching this offering across Apollo database
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "ems",
                  "electronics manufacturing",
                  "pcb assembly",
                  "cable assembly",
                  "module building",
                  "industrial",
                  "railway",
                  "healthcare",
                  "automotive",
                  "defense"
                ].map((keyword) => (
                  <div key={keyword} className="px-3 py-1 border-2 border-black text-sm font-bold">
                    {keyword}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-8">
              <Button
                onClick={() => navigate("/")}
                className="text-2xl px-12 py-8 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black transition-colors flex-1"
              >
                [PROCEED TO SEARCH]
              </Button>
              <Button
                onClick={() => (window.location.href = "/")}
                variant="outline"
                className="text-xl px-8 py-6 font-black border-4 border-black"
              >
                BACK
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
