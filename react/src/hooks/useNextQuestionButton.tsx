import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Answer, TestResultState, TestState } from "../types/state";

export const useNextQuestionButton = (
  questionNumber: number,
  subject: string,
  choice: string,
  correctChoice: string,
  questionUpdater: () => void
) => {
  const [answerProgress, setAnswerProgress] = useState<Answer[]>([]);

  const navigate = useNavigate();

  const location = useLocation();
  const { testName, testLength } = location.state as TestState;

  const { testId } = useParams();

  const onClickNextQuestionButton = async () => {
    // 回答結果を更新
    const answer: Answer = { subject, choice, correctChoice };
    const updatedAnswerProgress = [...answerProgress, answer];

    if (questionNumber === testLength) {
      // 結果へ遷移
      const state: TestResultState = {
        testName,
        testLength,
        answerProgress: updatedAnswerProgress,
      };
      navigate(`/tests/${testId}/result`, { state });
    } else {
      // 次問題へ遷移
      setAnswerProgress(updatedAnswerProgress);
      questionUpdater();
    }
  };

  return onClickNextQuestionButton;
};
