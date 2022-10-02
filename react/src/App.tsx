import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { FC } from "react";
import { BrowserRouter } from "react-router-dom";
import { config } from "./services/msal";
import { Router } from "./router/Router";

export const App: FC<{}> = () => {
  const msalInstance = new PublicClientApplication(config);

  return (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </MsalProvider>
  );
};
