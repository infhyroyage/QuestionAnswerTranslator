import { useAccount, useMsal } from "@azure/msal-react";
import { useState } from "react";
import { accessFunctions } from "../services/functions";
import { GetQuestionAnswer, Sentence } from "../types/functions";
import { useParams } from "react-router-dom";

export const useTestSubmitter = (
  questionNumber: number,
  disableTestInputer: () => void
) => {
  const [correctIdxes, setCorrectIdxes] = useState<number[]>([]);
  const [explanations, setExplanations] = useState<Sentence[]>([]);
  const [references, setReferences] = useState<string[]>([]);

  const { instance, accounts } = useMsal();
  const accountInfo = useAccount(accounts[0] || {});

  const { testId } = useParams();

  const initializeTestSubmitter = () => {
    setCorrectIdxes([]);
    setExplanations([]);
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
    setExplanations(res.explanations);
    setReferences(res.references);
  };

  return {
    correctIdxes,
    explanations,
    references,
    initializeTestSubmitter,
    onClickSubmitButton,
  };
};
