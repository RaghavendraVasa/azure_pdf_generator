import * as common from './common';
import * as nodeApi from 'azure-devops-node-api';
import * as TestApi from 'azure-devops-node-api/TestApi';
import * as TestInterfaces from 'azure-devops-node-api/interfaces/TestInterfaces';
import { PDFDocument, PageSizes } from 'pdf-lib'
import { BlobServiceClient } from '@azure/storage-blob'
import * as dotenv from 'dotenv'
dotenv.config()


async function pdf(runId: number) {
    const doc = await PDFDocument.create()
    const projectId: string = common.getProject();
    const webApi: nodeApi.WebApi = await common.getWebApi();
    const testApiObject: TestApi.ITestApi = await webApi.getTestApi();
    const testResultsByRunId: TestInterfaces.TestCaseResult[] = await testApiObject.getTestResults(projectId, runId)

    for await (let testResult of testResultsByRunId){
        const attachments: TestInterfaces.TestAttachment[] = await testApiObject.getTestResultAttachments(projectId, runId, testResult.id as number)

        let filtered_attachments = attachments.filter(function (attachment) {
            if (attachment.fileName?.endsWith('.png')) {
                return attachment;
            }
        })

        let dividedArray = await sliceIntoChunks(filtered_attachments, 2)

        for await(let item of dividedArray){
            if (item.length == 2 && item[0].fileName?.startsWith('Before') && item[1].fileName?.startsWith('After')) {
                let beforeReadableStream: NodeJS.ReadableStream = await testApiObject.getTestResultAttachmentContent(projectId, runId, testResult.id as number, item[0].id)
                let afterReadableStream: NodeJS.ReadableStream = await testApiObject.getTestResultAttachmentContent(projectId, runId, testResult.id as number, item[1].id)
                await createPage(doc,testResult.testCaseTitle as string, testResult.outcome as string, item[0].fileName?.split('_').join(' ') as string,
                    await streamToString(beforeReadableStream), item[1].fileName?.split('_').join(' ') as string, await streamToString(afterReadableStream))
            }
            else if (item.length == 1 && item[0].fileName?.startsWith('Before')) {
                let beforeReadableStream: NodeJS.ReadableStream = await testApiObject.getTestResultAttachmentContent(projectId, runId, testResult.id as number, item[0].id)
                await createPage(doc,testResult.testCaseTitle as string, testResult.outcome as string, item[0].fileName?.split('_').join(' ') as string,
                    await streamToString(beforeReadableStream))
            }
        }
    }
    const pdfBytes= await doc.save()
    await uploadToBlob(`./Run-${runId}.pdf`,pdfBytes)
}

async function createPage(doc: PDFDocument,testCase: string, status: string, beforeStep: string, beforeImg: string, afterStep?: string, afterImg?: string) {
    const page = doc.addPage([PageSizes.A4[1], PageSizes.A4[0]])
    page.drawText(`Test case name: ${testCase}`, {
        x: 20,
        y: page.getHeight() - 20,
        size: 14
    })

    page.drawText(`Status: ${status}`, {
        x: page.getWidth() - 120,
        y: page.getHeight() - 20,
        size: 14
    })

    page.drawText(beforeStep, {
        x: 20,
        y: page.getHeight() - 50,
        size: 12
    })

    let bimage = await doc.embedPng(beforeImg)
    page.drawImage(bimage, {
        x: 20,
        y: page.getHeight() / 2,
        width: bimage.scale(0.2).width,
        height: bimage.scale(0.2).height,
    })

    if (typeof afterStep !== 'undefined') {
        page.drawText(afterStep as string, {
            x: page.getWidth() / 2 + 10,
            y: page.getHeight() - 50,
            size: 12
        })
    }

    if (typeof afterImg !== 'undefined') {
        let aimage = await doc.embedPng(afterImg)
        page.drawImage(aimage, {
            x: page.getWidth() / 2 + 10,
            y: page.getHeight() / 2,
            width: aimage.scale(0.2).width,
            height: aimage.scale(0.2).height,
        })
    }
}

async function sliceIntoChunks(arr: TestInterfaces.TestAttachment[], chunkSize: number) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

async function uploadToBlob(fileName: string, pdfBytes: Uint8Array) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(String(process.env.AZURE_STORAGE_CONNECTION_STRING))
    const containerClient = blobServiceClient.getContainerClient('pdf-container')
    const blockBlobClient = containerClient.getBlockBlobClient(fileName)
    await blockBlobClient.upload(pdfBytes,pdfBytes.byteLength)
}

async function streamToString(stream: NodeJS.ReadableStream) {
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('base64');
}

pdf(234)
