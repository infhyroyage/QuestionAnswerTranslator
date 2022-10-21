import { useAccount, useMsal } from "@azure/msal-react";
import { useState } from "react";
import { accessFunctions } from "../services/functions";
import { ExplanationSentences, GetQuestionAnswer } from "../types/functions";
import { useParams } from "react-router-dom";

const INIT_EXPLANATION_SENTENCES = { overall: [], incorrectChoices: {} };

export const useTestSubmitter = (
  questionNumber: number,
  disableTestInputer: () => void
) => {
  const [correctIdxes, setCorrectIdxes] = useState<number[]>([]);
  const [explanationSentences, setExplanationSentences] =
    useState<ExplanationSentences>(INIT_EXPLANATION_SENTENCES);
  const [references, setReferences] = useState<string[]>([]);

  const { instance, accounts } = useMsal();
  const accountInfo = useAccount(accounts[0] || {});

  const { testId } = useParams();

  const initializeTestSubmitter = () => {
    setCorrectIdxes([]);
    setExplanationSentences(INIT_EXPLANATION_SENTENCES);
    setReferences([]);
  };

  const onClickSubmitButton = async () => {
    // 再回答させないように無効化
    disableTestInputer();

    // 初回レンダリング時のみ[GET] /tests/{testId}/questions/{questionNumber}/answerを実行
    const res: GetQuestionAnswer = await accessFunctions<GetQuestionAnswer>(
      "GET",
      `/tests/${testId}/questions/${questionNumber}/answer`,
      instance,
      accountInfo
    );

    setCorrectIdxes(res.correctIdxes);
    setExplanationSentences(res.explanations);
    setReferences(res.references);
  };

  return {
    correctIdxes,
    explanationSentences,
    references,
    initializeTestSubmitter,
    onClickSubmitButton,
  };
};
