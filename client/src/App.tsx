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


function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Brain} />
        <Route path={"/search-scenario"} component={SearchScenario} />
        <Route path={"/search-results/:searchId"} component={SearchResults} />
        <Route path={"/deep-research"} component={DeepResearchDashboard} />
        <Route path={"/exclusions"} component={Exclusions} />
        <Route path={"/import-campaign"} component={ImportCampaign} />
        <Route path={"/brain"} component={Brain} />

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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
