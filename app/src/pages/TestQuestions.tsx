import { AuthenticatedTemplate, useAccount, useMsal } from "@azure/msal-react";
import { FC, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { TestChoiceContent } from "../components/TestChoiceContent";
import { TestSentenceContent } from "../components/TestSentenceContent";
import { TestTranslationErrorContent } from "../components/TestTranslationErrorContent";
import { useTestInputer } from "../hooks/useTestInputer";
import { useNextQuestionButton } from "../hooks/useNextQuestionButton";
import { useTestSubmitter } from "../hooks/useTestSubmitter";
import { translate } from "../services/deepl";
import { accessFunctions } from "../services/functions";
import { GetQuestion } from "../types/functions";
import { TestState } from "../types/state";

const INIT_GET_QESTION_RES = { subjects: [], choices: [] };

const concatSentences = (sentences: string[]) =>
  sentences.reduce(
    (prev: string, sentence: string) =>
      prev === "" ? `${prev} ${sentence}` : sentence,
    ""
  );

export const TestQuestions: FC<{}> = () => {
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [getQuestionRes, setGetQuestionRes] =
    useState<GetQuestion>(INIT_GET_QESTION_RES);
  const [translatedQuestions, setTranslatedQuestions] = useState<
    string[] | undefined
  >([]);
  const [translatedExplanations, setTranslatedExplanations] = useState<
    string[] | undefined
  >([]);
  const [isNotTranslatedQuestions, setIsNotTranslatedQuestions] =
    useState<boolean>(false);
  const [isNotTranslatedExplanations, setIsNotTranslatedExplanations] =
    useState<boolean>(false);

  const { instance, accounts } = useMsal();
  const accountInfo = useAccount(accounts[0] || {});

  const location = useLocation();
  const { testName, testLength } = location.state as TestState;

  const { testId } = useParams();

  const {
    selectedIdx,
    isDisabledRadioButtons,
    isDisabledSubmitButton,
    initializeTestInputer,
    disableTestInputer,
    onChangeRadioButtonInner,
  } = useTestInputer();

  const {
    correctIdx,
    explanations,
    initializeTestSubmitter,
    onClickSubmitButton,
  } = useTestSubmitter(questionNumber, disableTestInputer);

  const updateNextQuestion = () => {
    initializeTestSubmitter();
    setTranslatedQuestions([]);
    setGetQuestionRes(INIT_GET_QESTION_RES);
    setTranslatedExplanations([]);
    initializeTestInputer();
    setQuestionNumber(questionNumber + 1);
  };

  const onClickNextQuestionButton = useNextQuestionButton(
    questionNumber,
    concatSentences(getQuestionRes.subjects),
    getQuestionRes.choices[Number(selectedIdx)],
    getQuestionRes.choices[Number(correctIdx)],
    updateNextQuestion
  );

  // 初回レンダリング時のみ[GET] /tests/{testId}/questions/{questionNumber}を実行
  useEffect(() => {
    (async () => {
      const res: GetQuestion = await accessFunctions<GetQuestion>(
        "GET",
        `/tests/${testId}/questions/${questionNumber}`,
        instance,
        accountInfo
      );
      setGetQuestionRes(res);
    })();
  }, [testId, questionNumber, instance, accountInfo]);

  // [GET] /tests/{testId}/questions/{questionNumber}実行直後のみ翻訳
  useEffect(() => {
    getQuestionRes.subjects.length &&
      getQuestionRes.choices.length &&
      (async () => {
        // subjects、choicesそれぞれの文字列に対してDeepL翻訳を計2回行わず、
        // subjects、choicesの順で配列を作成した文字列に対してDeepL翻訳を1回のみ行う
        try {
          const translatedQuestions = await translate([
            ...getQuestionRes.subjects,
            ...getQuestionRes.choices,
          ]);
          setTranslatedQuestions(translatedQuestions);
        } catch (e) {
          setTranslatedQuestions(undefined);
          setIsNotTranslatedQuestions(true);
        }
      })();
  }, [getQuestionRes]);

  // [GET] /tests/{testId}/questions/{questionNumber}/answer実行直後のみ翻訳
  useEffect(() => {
    explanations.length &&
      (async () => {
        try {
          const translatedSentences = await translate(explanations);
          setTranslatedExplanations(translatedSentences);
        } catch (e) {
          setTranslatedExplanations(undefined);
          setIsNotTranslatedExplanations(true);
        }
      })();
  }, [explanations]);

  return (
    <AuthenticatedTemplate>
      <h1>{testName}</h1>
      <h2>
        問題{questionNumber} (全{testLength}問)
      </h2>
      {isNotTranslatedQuestions && (
        <TestTranslationErrorContent
          sentences={[...getQuestionRes.subjects, ...getQuestionRes.choices]}
          setTranslatedSentences={setTranslatedQuestions}
          setIsNotTranslatedSentences={setIsNotTranslatedQuestions}
        />
      )}
      <div>
        <TestSentenceContent
          sentences={getQuestionRes.subjects}
          translatedSentences={
            translatedQuestions &&
            translatedQuestions.slice(0, getQuestionRes.subjects.length)
          }
        />
      </div>
      <div>
        <TestChoiceContent
          choices={getQuestionRes.choices}
          translatedChoices={
            translatedQuestions &&
            translatedQuestions.slice(getQuestionRes.subjects.length)
          }
          selectedIdx={selectedIdx}
          correctIdx={correctIdx}
          isDisabledRadioButtons={isDisabledRadioButtons}
          onChangeRadioButtonInner={onChangeRadioButtonInner}
        />
        <button
          onClick={onClickSubmitButton}
          disabled={isDisabledSubmitButton}
          style={{ marginTop: "14px" }}
        >
          回答
        </button>
      </div>
      {correctIdx !== "" && (
        <div style={{ paddingTop: "28px" }}>
          <h2>{correctIdx !== selectedIdx && "不"}正解</h2>
          {isNotTranslatedExplanations && (
            <TestTranslationErrorContent
              sentences={explanations}
              setTranslatedSentences={setTranslatedExplanations}
              setIsNotTranslatedSentences={setIsNotTranslatedExplanations}
            />
          )}
          <TestSentenceContent
            sentences={explanations}
            translatedSentences={translatedExplanations}
          />
          <button
            onClick={onClickNextQuestionButton}
            style={{ marginTop: "14px" }}
          >
            {questionNumber === testLength
              ? "結果"
              : `問題${questionNumber + 1}へ`}
          </button>
        </div>
      )}
    </AuthenticatedTemplate>
  );
};
