import { AuthenticatedTemplate } from "@azure/msal-react";
import { FC } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { TestState } from "../types/state";

export const TestReady: FC<{}> = () => {
  const location = useLocation();
  const { testName, testLength } = location.state as TestState;

  const { testId } = useParams();

  const navigate = useNavigate();

  const progressStr: string | null = localStorage.getItem("progress");

  const isStartedOtherTest: boolean =
    !!progressStr && JSON.parse(progressStr).testId !== testId;
  const isResumed: boolean =
    !!progressStr &&
    JSON.parse(progressStr).testId === testId &&
    JSON.parse(progressStr).answers.length > 0;

  const onClickStartButton = () => {
    localStorage.setItem(
      "progress",
      progressStr && isResumed
        ? progressStr
        : JSON.stringify({
            testId: `${testId}`,
            testName,
            testLength,
            answers: [],
          })
    );
    navigate(`/tests/${testId}/questions`);
  };

  return (
    <AuthenticatedTemplate>
      <h1>{testName}</h1>
      <h2>全{testLength}問</h2>
      {isStartedOtherTest && (
        <p style={{ color: "red" }}>
          ※最後に回答した別テストの回答データを削除して開始します
        </p>
      )}
      {isResumed && (
        <p style={{ color: "red" }}>※最後に回答した問題の直後から開始します</p>
      )}
      <button onClick={onClickStartButton} disabled={!testId}>
        開始
      </button>
    </AuthenticatedTemplate>
  );
};
