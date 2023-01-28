import { useAccount, useMsal } from "@azure/msal-react";
import { useState } from "react";
import { accessFunctions } from "../services/functions";
import {
  ExplanationSentences,
  GetQuestionAnswer,
  Sentence,
} from "../../../types/functions";
import { useParams } from "react-router-dom";
import { ProgressState } from "../../../types/routerState";

const INIT_EXPLANATION_SENTENCES = { overall: [], incorrectChoices: {} };

export const useTestSubmitter = (
  choices: Sentence[],
  selectedIdxes: number[],
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
    const progressState: ProgressState = JSON.parse(
      localStorage.getItem("progress") as string
    );
    const res: GetQuestionAnswer = await accessFunctions<GetQuestionAnswer>(
      "GET",
      `/tests/${testId}/questions/${progressState.answers.length + 1}/answer`,
      instance,
      accountInfo
    );

    // 回答結果をLocal Storageに一時保存
    const choiceSentences: string[] = selectedIdxes.map(
      (selectedIdx: number) => choices[selectedIdx].sentence
    );
    const correctChoiceSentences: string[] = res.correctIdxes.map(
      (correctIdx: number) => choices[correctIdx].sentence
    );
    const updatedProgressState: ProgressState = {
      ...progressState,
      answers: [
        ...progressState.answers,
        {
          choiceSentences,
          correctChoiceSentences,
        },
      ],
    };
    localStorage.setItem("progress", JSON.stringify(updatedProgressState));

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
