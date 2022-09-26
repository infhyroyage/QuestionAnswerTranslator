import { FC } from "react";
import { Route, Routes } from "react-router-dom";

import { LoginMyPage } from "../pages/LoginMyPage";
import { TestReady } from "../pages/TestReady";
import { TestQuestions } from "../pages/TestQuestions";
import { TestResult } from "../pages/TestResult";
import { NotFound } from "../pages/NotFound";

export const Router: FC<{}> = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginMyPage />} />
      <Route path="/tests/:testId" element={<TestReady />} />
      <Route path="/tests/:testId/questions" element={<TestQuestions />} />
      <Route path="/tests/:testId/result" element={<TestResult />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
