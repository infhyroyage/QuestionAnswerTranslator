import { AuthenticatedTemplate } from "@azure/msal-react";
import { FC } from "react";
import { Link, useLocation } from "react-router-dom";
import { Answer, TestResultState } from "../types/state";

export const TestResult: FC<{}> = () => {
  const location = useLocation();
  const { testName, testLength, answerProgress } =
    location.state as TestResultState;

  return (
    <AuthenticatedTemplate>
      <h1>{testName}</h1>
      <h2>
        正答率
        {(
          (100.0 *
            answerProgress.filter(
              (answer: Answer) => answer.choice === answer.correctChoice
            ).length) /
          testLength
        ).toFixed(1)}
        %
      </h2>
      <p>
        (全{testLength}問中
        {
          answerProgress.filter(
            (answer: Answer) => answer.choice === answer.correctChoice
          ).length
        }
        問正解)
      </p>
      <Link to="/">タイトルへ</Link>
      <div style={{ paddingTop: "28px" }}>
        <h2>回答詳細</h2>
        {answerProgress.map((answer: Answer, idx: number) => (
          <div key={`result_${idx}`} style={{ paddingBottom: "7px" }}>
            <h4
              style={{
                color: answer.choice === answer.correctChoice ? "black" : "red",
              }}
            >
              問題{idx + 1} ({answer.choice !== answer.correctChoice && "不"}
              正解)
            </h4>
            <p>{answer.subject}</p>
            <ul>
              <li>選択肢：{answer.choice}</li>
              <li>回答：{answer.correctChoice}</li>
            </ul>
          </div>
        ))}
      </div>
    </AuthenticatedTemplate>
  );
};
