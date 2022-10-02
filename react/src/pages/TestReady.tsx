import { AuthenticatedTemplate } from "@azure/msal-react";
import { FC } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { TestState } from "../types/state";

export const TestReady: FC<{}> = () => {
  const location = useLocation();
  const { testName, testLength } = location.state as TestState;

  const { testId } = useParams();

  const navigate = useNavigate();
  const onClickStartButton = () => {
    navigate(`/tests/${testId}/questions`, { state: location.state });
  };

  return (
    <AuthenticatedTemplate>
      <h1>{testName}</h1>
      <h2>全{testLength}問</h2>
      <button onClick={onClickStartButton} disabled={!testId}>
        開始
      </button>
    </AuthenticatedTemplate>
  );
};
