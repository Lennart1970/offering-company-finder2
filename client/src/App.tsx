import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import FocusedOffering from "./pages/FocusedOffering";
import SearchScenario from "./pages/SearchScenario";
import SearchResults from "./pages/SearchResults";
import DeepResearchDashboard from "./pages/DeepResearchDashboard";
import Exclusions from "./pages/Exclusions";
import ImportCampaign from "./pages/ImportCampaign";
import Brain from "./pages/Brain";
import ConferenceImport from "./pages/ConferenceImport";
import ExcelImport from "./pages/ExcelImport";
import CallToday from "./pages/CallToday";
import CompanyDetail from "./pages/CompanyDetail";
import CompanyDetailMagazine from "./pages/CompanyDetailMagazine";
import NurtureList from "./pages/NurtureList";
import PromptRepository from "./pages/PromptRepository";
import WebhookLogPage from "./pages/WebhookLogPage";
import BrainVisibility from "./pages/BrainVisibility";
import SalesMaterials from "./pages/SalesMaterials";
import NicheReview from "./pages/NicheReview";
import NicheCompanyList from "./pages/NicheCompanyList";
import FastPrototype from "./pages/FastPrototype";
import PrototypeRequests from "./pages/PrototypeRequests";
import LeadinfoImport from "@/pages/LeadinfoImport";
import SalesMenu from "@/pages/SalesMenu";
import SyncPage from "@/pages/SyncPage";
import IntelligencePage from "@/pages/IntelligencePage";
import ConnectGroupMarket from "./pages/ConnectGroupMarket";
import ConnectGroupSites from "./pages/ConnectGroupSites";
import ConnectGroupTeam from "./pages/ConnectGroupTeam";
import TermsOfUse from "./pages/TermsOfUse";
import SharePage from "./pages/SharePage";
import ShareListPage from "./pages/ShareListPage";
import ShareBrainPage from "./pages/ShareBrainPage";


function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Brain} />
        <Route path={"/search-scenario"} component={SearchScenario} />
        <Route path={"/sales-menu"} component={SalesMenu} />
        <Route path={"/sync"} component={SyncPage} />
        <Route path={"/intelligence"} component={IntelligencePage} />
        <Route path={"/search-results"} component={SearchResults} />
        <Route path={"/search-results/:searchId"} component={SearchResults} />
        <Route path={"/deep-research"} component={DeepResearchDashboard} />
        <Route path={"/exclusions"} component={Exclusions} />
        <Route path={"/import-campaign"} component={ImportCampaign} />
        <Route path={"/conference-import"} component={ConferenceImport} />
        <Route path={"/excel-import"} component={ExcelImport} />
        <Route path={"/brain"} component={Brain} />
        <Route path={"/call-today"} component={CallToday} />
        <Route path={"/call-today/:searchId"} component={CallToday} />
        <Route path={"/company/:companyId/extended"} component={CompanyDetail} />
        <Route path={"/company/:companyId"} component={CompanyDetailMagazine} />
        <Route path={"/nurture"} component={NurtureList} />
        <Route path={"/prompts"} component={PromptRepository} />
        <Route path={"/webhook-log"} component={WebhookLogPage} />
        <Route path={"/brain-visibility"} component={BrainVisibility} />
        <Route path={"/sales-materials"} component={SalesMaterials} />
        <Route path={"/niche-review"} component={NicheReview} />
        <Route path={"/fast-prototype"} component={FastPrototype} />
        <Route path={"/prototype-requests"} component={PrototypeRequests} />
        <Route path={"/leadinfo"} component={LeadinfoImport} />
        <Route path={"/cg-market"} component={ConnectGroupMarket} />
        <Route path={"/cg-sites"} component={ConnectGroupSites} />
        <Route path={"/cg-team"} component={ConnectGroupTeam} />
        <Route path={"/terms"} component={TermsOfUse} />
        <Route path={"/niche/:nicheId"} component={({ params }: { params: { nicheId: string } }) => <NicheCompanyList nicheId={parseInt(params.nicheId)} />} />

        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* Public share list page — no login required */}
            <Route path="/share/list/:listToken" component={({ params }: { params: { listToken: string } }) => <ShareListPage />} />
            {/* Public brain share page — no login required */}
            <Route path="/share/brain/:token" component={({ params }: { params: { token: string } }) => <ShareBrainPage />} />
            {/* Public share page — no login required, no sidebar */}
            <Route path="/share/:token" component={({ params }: { params: { token: string } }) => <SharePage />} />
            {/* All other routes go through DashboardLayout */}
            <Route component={Router} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
