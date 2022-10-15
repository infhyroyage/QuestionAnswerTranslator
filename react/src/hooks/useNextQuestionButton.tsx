import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { GetQuestion, Sentence } from "../types/functions";
import { Answer, TestResultState, TestState } from "../types/state";

export const useNextQuestionButton = (
  questionNumber: number,
  getQuestionRes: GetQuestion,
  selectedIdxes: number[],
  correctIdxes: number[],
  questionUpdater: () => void
) => {
  const [answerProgress, setAnswerProgress] = useState<Answer[]>([]);

  const navigate = useNavigate();

  const location = useLocation();
  const { testName, testLength } = location.state as TestState;

  const { testId } = useParams();

  const onClickNextQuestionButton = async () => {
    // 回答結果を更新
    const subjectConcatSentence: string = getQuestionRes.subjects.reduce(
      (prevSubjectConcatSentence: string, subject: Sentence) =>
        prevSubjectConcatSentence === ""
          ? `${prevSubjectConcatSentence} ${subject.sentence}`
          : subject.sentence,
      ""
    );
    const choiceSentences: string[] = selectedIdxes.map(
      (selectedIdx: number) => getQuestionRes.choices[selectedIdx].sentence
    );
    const correctChoiceSentences: string[] = correctIdxes.map(
      (correctIdx: number) => getQuestionRes.choices[correctIdx].sentence
    );
    const answer: Answer = {
      subjectConcatSentence,
      choiceSentences,
      correctChoiceSentences,
    };
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
