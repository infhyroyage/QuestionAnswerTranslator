import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { FC } from "react";
import { BrowserRouter } from "react-router-dom";
import { RecoilRoot } from "recoil";
import { config } from "./services/msal";
import { Router } from "./router/Router";

export const App: FC<{}> = () => {
  const msalInstance = new PublicClientApplication(config);

  return (
    <MsalProvider instance={msalInstance}>
      <RecoilRoot>
        <BrowserRouter>
          <Router />
        </BrowserRouter>
      </RecoilRoot>
    </MsalProvider>
  );
};
