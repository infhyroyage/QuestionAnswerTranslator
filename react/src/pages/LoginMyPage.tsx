import { FC } from "react";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { AllTestsContent } from "../components/AllTestsContent";
import { loginScope } from "../services/msal";

export const LoginMyPage: FC<{}> = () => {
  const { instance } = useMsal();

  const onClickLogin = async () => {
    try {
      await instance.loginRedirect(loginScope);
    } catch (e) {
      console.error(e);
    }
  };

  const onClickLogout = async () => {
    try {
      await instance.logoutRedirect();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <UnauthenticatedTemplate>
        <h1>Login</h1>
        <button onClick={onClickLogin}>ログイン</button>
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <h1>MyPage</h1>
        <button onClick={onClickLogout}>ログアウト</button>
        <AllTestsContent />
      </AuthenticatedTemplate>
    </>
  );
};
