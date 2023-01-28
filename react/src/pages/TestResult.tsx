import { AuthenticatedTemplate } from "@azure/msal-react";
import { FC } from "react";
import { Link, useLocation } from "react-router-dom";
import { Answer, ProgressState } from "../../../types/routerState";

export const TestResult: FC<{}> = () => {
  const location = useLocation();
  const { testName, testLength, answers } = location.state as ProgressState;

  return (
    <AuthenticatedTemplate>
      <h1>{testName}</h1>
      <h2>
        正答率
        {(
          (100.0 *
            answers.filter(
              (answer: Answer) =>
                answer.choiceSentences.toString() ===
                answer.correctChoiceSentences.toString()
            ).length) /
          testLength
        ).toFixed(1)}
        %
      </h2>
      <p>
        (全{testLength}問中
        {
          answers.filter(
            (answer: Answer) =>
              answer.choiceSentences.toString() ===
              answer.correctChoiceSentences.toString()
          ).length
        }
        問正解)
      </p>
      <Link to="/">タイトルへ</Link>
      <div style={{ paddingTop: "28px" }}>
        <h2>回答詳細</h2>
        {answers.map((answer: Answer, idx: number) => (
          <div key={`result_${idx}`} style={{ paddingBottom: "7px" }}>
            <h4
              style={{
                color:
                  answer.choiceSentences.toString() ===
                  answer.correctChoiceSentences.toString()
                    ? "black"
                    : "red",
              }}
            >
              問題{idx + 1} (
              {answer.choiceSentences.toString() !==
                answer.correctChoiceSentences.toString() && "不"}
              正解)
            </h4>
            <ul>
              <li>選択肢</li>
              <ul>
                {answer.choiceSentences.map(
                  (choiceSentence: string, choiceSentenceIdx: number) => (
                    <li key={`choiceSentences_${choiceSentenceIdx}`}>
                      {choiceSentence}
                    </li>
                  )
                )}
              </ul>
              <li>回答</li>
              <ul>
                {answer.correctChoiceSentences.map(
                  (
                    correctChoiceSentence: string,
                    correctChoiceSentenceIdx: number
                  ) => (
                    <li
                      key={`correctChoiceSentences_${correctChoiceSentenceIdx}`}
                    >
                      {correctChoiceSentence}
                    </li>
                  )
                )}
              </ul>
            </ul>
          </div>
        ))}
      </div>
    </AuthenticatedTemplate>
  );
};
