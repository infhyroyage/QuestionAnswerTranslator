import { AuthenticatedTemplate, useAccount, useMsal } from "@azure/msal-react";
import { FC, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { TestChoiceContent } from "../components/TestChoiceContent";
import { TestExplanationIncorrectChoiceContent } from "../components/TestExplanationIncorrectChoiceContent";
import { TestSentenceContent } from "../components/TestSentenceContent";
import { TestTranslationErrorContent } from "../components/TestTranslationErrorContent";
import { useTestInputer } from "../hooks/useTestInputer";
import { useNextQuestionButton } from "../hooks/useNextQuestionButton";
import { useTestSubmitter } from "../hooks/useTestSubmitter";
import { translate } from "../services/deepl";
import { accessFunctions } from "../services/functions";
import { GetQuestion, Sentence } from "../types/functions";
import { TestState } from "../types/state";

const INIT_GET_QESTION_RES = {
  subjects: [],
  choices: [],
  isCorrectedMulti: false,
};

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
    selectedIdxes,
    isDisabledChoiceInput,
    isDisabledSubmitButton,
    initializeTestInputer,
    disableTestInputer,
    onChangeChoiceInput,
  } = useTestInputer();

  const {
    correctIdxes,
    explanationSentences,
    references,
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
    getQuestionRes,
    selectedIdxes,
    correctIdxes,
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
        // subjects、choicesそれぞれの文字列に対してDeepL翻訳を複数回行わず、
        // subjects、choicesの順で配列を作成した文字列に対してDeepL翻訳を1回のみ行う
        const sentences: Sentence[] = [
          ...getQuestionRes.subjects,
          ...getQuestionRes.choices,
        ];
        try {
          const translatedStrings: string[] = await translate(sentences);
          setTranslatedQuestions(translatedStrings);
        } catch (e) {
          setTranslatedQuestions(undefined);
          setIsNotTranslatedQuestions(true);
        }
      })();
  }, [getQuestionRes]);

  // [GET] /tests/{testId}/questions/{questionNumber}/answer実行直後のみ翻訳
  useEffect(() => {
    explanationSentences.overall.length &&
      (async () => {
        // overall、incorrectChoices内のそれぞれの文字列に対してDeepL翻訳を複数回行わず、
        // overall、incorrectChoices内の順で配列を作成した文字列に対してDeepL翻訳を1回のみ行う
        const sentences: Sentence[] = Object.keys(
          explanationSentences.incorrectChoices
        ).reduce(
          (prevSentences: Sentence[], choiceIdx: string) =>
            prevSentences.concat(
              explanationSentences.incorrectChoices[Number(choiceIdx)]
            ),
          [...explanationSentences.overall]
        );
        try {
          const translatedStrings: string[] = await translate(sentences);
          setTranslatedExplanations(translatedStrings);
        } catch (e) {
          setTranslatedExplanations(undefined);
          setIsNotTranslatedExplanations(true);
        }
      })();
  }, [explanationSentences]);

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
          isCorrectedMulti={getQuestionRes.isCorrectedMulti}
          translatedChoices={
            translatedQuestions &&
            translatedQuestions.slice(getQuestionRes.subjects.length)
          }
          selectedIdxes={selectedIdxes}
          correctIdxes={correctIdxes}
          isDisabledChoiceInput={isDisabledChoiceInput}
          onChangeChoiceInput={onChangeChoiceInput}
        />
        <button
          onClick={onClickSubmitButton}
          disabled={isDisabledSubmitButton}
          style={{ marginTop: "14px" }}
        >
          回答
        </button>
      </div>
      {correctIdxes.length > 0 && (
        <div style={{ paddingTop: "28px" }}>
          <h2>
            {correctIdxes.toString() !== selectedIdxes.toString() && "不"}正解
          </h2>
          <button
            onClick={onClickNextQuestionButton}
            style={{ marginTop: "7px" }}
          >
            {questionNumber === testLength
              ? "結果"
              : `問題${questionNumber + 1}へ`}
          </button>
          <h3>解説</h3>
          {isNotTranslatedExplanations && (
            <TestTranslationErrorContent
              sentences={Object.keys(
                explanationSentences.incorrectChoices
              ).reduce(
                (prevSentences: Sentence[], choiceIdx: string) =>
                  prevSentences.concat(
                    explanationSentences.incorrectChoices[Number(choiceIdx)]
                  ),
                [...explanationSentences.overall]
              )}
              setTranslatedSentences={setTranslatedExplanations}
              setIsNotTranslatedSentences={setIsNotTranslatedExplanations}
            />
          )}
          <TestSentenceContent
            sentences={explanationSentences.overall}
            translatedSentences={
              translatedExplanations &&
              translatedExplanations.slice(
                0,
                explanationSentences.overall.length
              )
            }
          />
          {!!Object.keys(explanationSentences.incorrectChoices).length && (
            <TestExplanationIncorrectChoiceContent
              choices={getQuestionRes.choices}
              translatedChoices={
                translatedQuestions &&
                translatedQuestions.slice(getQuestionRes.subjects.length)
              }
              incorrectChoices={explanationSentences.incorrectChoices}
              translatedIncorrectChoices={
                translatedExplanations &&
                translatedExplanations.slice(
                  explanationSentences.overall.length
                )
              }
            />
          )}
          {!!references.length && (
            <>
              <h3>参照</h3>
              <ul>
                {references.map((reference: string, idx: number) => (
                  <li key={idx}>
                    <a
                      href={reference}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {reference}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </AuthenticatedTemplate>
  );
};
