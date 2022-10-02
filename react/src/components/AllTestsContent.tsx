import { useAccount, useMsal } from "@azure/msal-react";
import React, { FC, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GetTests, Test } from "../types/functions";
import { TestState } from "../types/state";
import { accessFunctions } from "../services/functions";

export const AllTestsContent: FC<{}> = () => {
  const [getTestsRes, setGetTestsRes] = useState<GetTests>({});

  const { instance, accounts } = useMsal();
  const accountInfo = useAccount(accounts[0] || {});

  // 初回レンダリング時のみ[GET] /testsを実行
  useEffect(() => {
    (async () => {
      const res: GetTests = await accessFunctions<GetTests>(
        "GET",
        "/tests",
        instance,
        accountInfo
      );
      setGetTestsRes(res);
    })();
  }, [accountInfo, instance]);

  return (
    <>
      {Object.keys(getTestsRes).map((course: string) => (
        <React.Fragment key={course}>
          <h4>{course}</h4>
          <ul>
            {getTestsRes[course].map((test: Test) => {
              const testState: TestState = {
                testName: test.test,
                testLength: test.length,
              };
              return (
                <li key={test.id}>
                  <Link to={`/tests/${test.id}`} state={testState}>
                    {test.test}
                  </Link>
                </li>
              );
            })}
          </ul>
        </React.Fragment>
      ))}
    </>
  );
};
