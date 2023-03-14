import * as common from "./common";
import * as nodeApi from "azure-devops-node-api";
import * as TestApi from "azure-devops-node-api/TestApi";
import * as TestInterfaces from "azure-devops-node-api/interfaces/TestInterfaces";
import { PDFDocument, PageSizes } from "pdf-lib";
import { BlobServiceClient } from "@azure/storage-blob";
import * as dotenv from "dotenv";
import ReactPDF from "@react-pdf/renderer";
import { MyDocument } from "./Pdf_Screen";
import fs from "fs";
dotenv.config();

async function pdf(runId: number) {
  const PDFMerger = require("pdf-merger-js");
  var merger = new PDFMerger();
  const doc = await PDFDocument.create();
  const doctest = await PDFDocument.create();
  const projectId: string = common.getProject();
  const webApi: nodeApi.WebApi = await common.getWebApi();
  const testApiObject: TestApi.ITestApi = await webApi.getTestApi();
  const testResultsByRunId: TestInterfaces.TestCaseResult[] =
    await testApiObject.getTestResults(projectId, runId);

  for await (let testResult of testResultsByRunId) {
    const attachments: TestInterfaces.TestAttachment[] =
      await testApiObject.getTestResultAttachments(
        projectId,
        runId,
        testResult.id as number
      );

    let filtered_attachments = attachments.filter(function (attachment) {
      if (attachment.fileName?.endsWith(".png")) {
        return attachment;
      }
    });

    let dividedArray = await sliceIntoChunks(filtered_attachments, 2);

    for await (let item of dividedArray) {
      try {
        if (
          item.length == 2 &&
          item[0].fileName?.startsWith("Before") &&
          item[1].fileName?.startsWith("After")
        ) {
          let beforeReadableStream: NodeJS.ReadableStream =
            await testApiObject.getTestResultAttachmentContent(
              projectId,
              runId,
              testResult.id as number,
              item[0].id
            );
          let afterReadableStream: NodeJS.ReadableStream =
            await testApiObject.getTestResultAttachmentContent(
              projectId,
              runId,
              testResult.id as number,
              item[1].id
            );
          await ReactPDF.render(
            MyDocument(
              testResult.testCaseTitle as string,
              testResult.outcome as string,
              item[0].fileName?.split("_").join(" ") as string,
              await streamToString(beforeReadableStream),
              item[1].fileName?.split("_").join(" ") as string,
              await streamToString(afterReadableStream)
            ),
            `${__dirname}/pdfBytes.pdf`
          );
          await merger.add("pdfBytes.pdf");
        } else if (item.length == 1 && item[0].fileName?.startsWith("Before")) {
          let beforeReadableStream: NodeJS.ReadableStream =
            await testApiObject.getTestResultAttachmentContent(
              projectId,
              runId,
              testResult.id as number,
              item[0].id
            );
            await ReactPDF.render(
              MyDocument(
                testResult.testCaseTitle as string,
                testResult.outcome as string,
                item[0].fileName?.split("_").join(" ") as string,
                await streamToString(beforeReadableStream),
              ),
              `${__dirname}/pdfBytes.pdf`
            );
            await merger.add("pdfBytes.pdf");
        }
      } catch (err) {
        console.log(err);
      }
    }
  }
  const bytes = await merger.saveAsBuffer();
  await uploadToBlob(`./Run-${runId}.pdf`, bytes);
}

async function sliceIntoChunks(
  arr: TestInterfaces.TestAttachment[],
  chunkSize: number
) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}

async function uploadToBlob(fileName: string, pdfBytes: Uint8Array) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    String(process.env.AZURE_STORAGE_CONNECTION_STRING)
  );
  const containerClient = blobServiceClient.getContainerClient("pdf-container");
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  await blockBlobClient.upload(pdfBytes, pdfBytes.byteLength);
}

export async function streamToString(stream: NodeJS.ReadableStream) {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("base64");
}

pdf(234);
