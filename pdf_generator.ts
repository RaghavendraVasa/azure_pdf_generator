import * as common from './common';
import * as nodeApi from 'azure-devops-node-api';
import * as TestApi from 'azure-devops-node-api/TestApi';
import * as TestInterfaces from 'azure-devops-node-api/interfaces/TestInterfaces';
import { PDFDocument, PageSizes } from 'pdf-lib'
import * as fs from 'fs'
import * as StreamPromises from "stream/promises";
import {BlobServiceClient} from '@azure/storage-blob'
import * as dotenv from 'dotenv'
dotenv.config()
const doc = PDFDocument.create()

async function pdf(runId: number) {
    const projectId: string = common.getProject();
    const webApi: nodeApi.WebApi = await common.getWebApi();
    const testApiObject: TestApi.ITestApi = await webApi.getTestApi();
    const testResultsByRunId: TestInterfaces.TestCaseResult[] = await testApiObject.getTestResults(projectId, runId)

    if (!fs.existsSync('./screenshots')) {
        fs.mkdirSync('./screenshots', { recursive: true })
    }

    const sortTestResultsByRunId = testResultsByRunId.sort((a, b) => {
        if(typeof a.id !=='undefined' && typeof b.id !=='undefined'){
            return a.id - b.id
        }
        return -1
    })

    await Promise.all(sortTestResultsByRunId.map(async (testResult) => {
        const attachments: TestInterfaces.TestAttachment[] = await testApiObject.getTestResultAttachments(projectId, runId, testResult.id as number)

        let filtered_attachments = attachments.filter(function (attachment) {
            if (attachment.fileName?.endsWith('.png')) {
                return attachment;
            }
        })

        await Promise.all(filtered_attachments.map(async (attachment) => {
            let readableStream: NodeJS.ReadableStream = await testApiObject.getTestResultAttachmentContent(projectId, runId, testResult.id as number, attachment.id)
            let writableStream = fs.createWriteStream(`./screenshots/${attachment.fileName}`)
            await StreamPromises.pipeline(readableStream, writableStream);
        }))

        let dividedArray = await sliceIntoChunks(filtered_attachments, 2)

        await Promise.all(dividedArray.map(async (item) => {
            if (item.length == 2 && item[0].fileName?.startsWith('Before') && item[1].fileName?.startsWith('After')) {
                await createPage(testResult.testCaseTitle as string, testResult.outcome as string, item[0].fileName?.split('_').join(' ') as string,
                    item[0].fileName as string, item[1].fileName?.split('_').join(' ') as string, item[1].fileName as string)
            }
            else if (item.length == 1 && item[0].fileName?.startsWith('Before')) {
                await createPage(testResult.testCaseTitle as string, testResult.outcome as string, item[0].fileName?.split('_').join(' ') as string,
                    item[0].fileName as string)
            }
        }))
    }))
    fs.writeFileSync(`./Run-${runId}.pdf`, await (await doc).save())
    fs.rmSync('./screenshots/',{recursive: true})
    await uploadToBlob(`Run-${runId}.pdf`)
    fs.rmSync(`./Run-${runId}.pdf`,{recursive: true})
}

async function createPage(testCase: string, status: string, beforeStep: string, beforeImg: string, afterStep?: string, afterImg?: string) {
    const page = (await doc).addPage([PageSizes.A4[1], PageSizes.A4[0]])
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

    let bimage = await (await doc).embedPng(fs.readFileSync(`./screenshots/${beforeImg}`))
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
        let aimage = await (await doc).embedPng(fs.readFileSync(`./screenshots/${afterImg}`))
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

async function uploadToBlob(fileName: string){
    const blobServiceClient = BlobServiceClient.fromConnectionString(String(process.env.AZURE_STORAGE_CONNECTION_STRING))
    const containerClient = blobServiceClient.getContainerClient('pdf-container')
    const blockBlobClient = containerClient.getBlockBlobClient(fileName)
    await blockBlobClient.uploadFile(`./${fileName}`)
}

pdf(234)
