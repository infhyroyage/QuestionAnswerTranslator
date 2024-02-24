import { app } from "@azure/functions";
import healthcheck from "./healthcheck";
import tests from "./tests";
import test from "./test";
import question from "./question";
import answer from "./answer";
import en2ja from "./en2ja";
import importItems from "./importItems";

app.http("healthcheck", {
  methods: ["GET"],
  authLevel: "function",
  handler: healthcheck,
});

app.http("en2ja", {
  methods: ["PUT"],
  authLevel: "function",
  handler: en2ja,
});

app.http("tests", {
  methods: ["GET"],
  authLevel: "function",
  handler: tests,
});

app.http("test", {
  methods: ["GET"],
  authLevel: "function",
  route: "tests/{testId}",
  handler: test,
});

app.http("question", {
  methods: ["GET"],
  authLevel: "function",
  route: "tests/{testId}/questions/{questionNumber}",
  handler: question,
});

app.http("answer", {
  methods: ["GET"],
  authLevel: "function",
  route: "tests/{testId}/questions/{questionNumber}/answer",
  handler: answer,
});

app.storageBlob("jsonContentBinary", {
  connection: "AzureWebJobsStorage",
  path: "import-items/{courseName}/{testName}.json",
  handler: importItems,
});
