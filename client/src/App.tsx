import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useAuth } from "./_core/hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
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
import BrainOverviewPage from "./pages/BrainOverviewPage";
import ShareAccessLogPage from "./pages/ShareAccessLogPage";
import ShareListsPage from "./pages/ShareListsPage";
import CampaignFromBrain from "./pages/CampaignFromBrain";
import TriggerReview from "./pages/TriggerReview";
import ImportPreview from "./pages/ImportPreview";
import RawDataPage from "./pages/RawDataPage";
import CompanyDatabase from "./pages/CompanyDatabase";
import DatabaseHealth from "./pages/DatabaseHealth";
import FeedbackPage from "./pages/FeedbackPage";


function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Brain} />
        <Route path={"/sales-menu"} component={SalesMenu} />
        <Route path={"/sync"} component={SyncPage} />
        <Route path={"/intelligence"} component={IntelligencePage} />
        <Route path={"/search-results"} component={SearchResults} />
        <Route path={"/search-results/:searchId"} component={SearchResults} />
        <Route path={"/import-preview/:searchId"} component={ImportPreview} />
        <Route path={"/raw-data"} component={RawDataPage} />
        <Route path={"/company-database"} component={CompanyDatabase} />
        <Route path={"/db-health"} component={DatabaseHealth} />
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
        <Route path={"/brain-visibility"} component={() => {
          const { user } = useAuth();
          if (!user) return null;
          if (user.role !== 'super_admin') return <div className="p-8 text-muted-foreground text-sm">Access restricted to super admins only.</div>;
          return <BrainVisibility />;
        }} />
        <Route path={"/sales-materials"} component={SalesMaterials} />
        <Route path={"/niche-review"} component={NicheReview} />
        <Route path={"/campaign-from-brain"} component={CampaignFromBrain} />
        <Route path={"/trigger-review"} component={TriggerReview} />
        <Route path={"/fast-prototype"} component={FastPrototype} />
        <Route path={"/prototype-requests"} component={PrototypeRequests} />
        <Route path={"/leadinfo"} component={LeadinfoImport} />
        <Route path={"/cg-market"} component={ConnectGroupMarket} />
        <Route path={"/cg-sites"} component={ConnectGroupSites} />
        <Route path={"/cg-team"} component={ConnectGroupTeam} />
        <Route path={"/terms"} component={TermsOfUse} />
        <Route path={"/share-access-log"} component={ShareAccessLogPage} />
        <Route path={"/feedback"} component={FeedbackPage} />
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
            {/* Public share lists overview — no login required */}
            <Route path="/share-lists" component={() => <ShareListsPage />} />
            {/* Public share list page — no login required */}
            <Route path="/share/brains" component={() => <BrainOverviewPage />} />
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
