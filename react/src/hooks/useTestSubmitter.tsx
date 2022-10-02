import { useAccount, useMsal } from "@azure/msal-react";
import { useState } from "react";
import { accessFunctions } from "../services/functions";
import { GetAnswer } from "../types/functions";
import { useParams } from "react-router-dom";

export const useTestSubmitter = (
  questionNumber: number,
  disableTestInputer: () => void
) => {
  const [correctIdx, setCorrectIdx] = useState<string>("");
  const [explanations, setExplanations] = useState<string[]>([]);

  const { instance, accounts } = useMsal();
  const accountInfo = useAccount(accounts[0] || {});

  const { testId } = useParams();

  const initializeTestSubmitter = () => {
    setCorrectIdx("");
    setExplanations([]);
  };

  const onClickSubmitButton = async () => {
    // 再回答させないように無効化
    disableTestInputer();

    // 初回レンダリング時のみ[GET] /tests/{testId}/questions/{questionNumber}/answerを実行
    const res: GetAnswer = await accessFunctions<GetAnswer>(
      "GET",
      `/tests/${testId}/questions/${questionNumber}/answer`,
      instance,
      accountInfo
    );

    setExplanations(res.explanations);
    setCorrectIdx(`${res.correctIdx}`);
  };

  return {
    correctIdx,
    explanations,
    initializeTestSubmitter,
    onClickSubmitButton,
  };
};
